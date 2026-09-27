import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

type Article = {
  id: string;
  title: string;
  summary: string;
  original_url: string;
};

export default function LibraryScreen() {
  const [savedArticles, setSavedArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchSavedArticles();
  }, []);

  const fetchSavedArticles = async () => {
    try {
      const userId = '00000000-0000-0000-0000-000000000000'; // Mock user

      // Fetch bookmarked article IDs
      const { data: interactions, error: interactionsError } = await supabase
        .from('user_interactions')
        .select('article_id')
        .eq('user_id', userId)
        .eq('is_bookmarked', true);

      if (interactionsError) throw interactionsError;

      if (!interactions || interactions.length === 0) {
        setSavedArticles([]);
        setLoading(false);
        return;
      }

      const articleIds = interactions.map(i => i.article_id);

      // Fetch the actual articles
      const { data: articles, error: articlesError } = await supabase
        .from('articles')
        .select('id, title, summary, original_url')
        .in('id', articleIds)
        .order('published_at', { ascending: false });

      if (articlesError) throw articlesError;
      
      setSavedArticles(articles || []);
    } catch (err) {
      console.error('Error fetching saved articles:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: Article }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => router.push(`/article/${item.id}`)}
    >
      <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
      <Text style={styles.summary} numberOfLines={3}>{item.summary}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Library</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#007aff" />
        </View>
      ) : savedArticles.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="bookmarks-outline" size={64} color="#333" />
          <Text style={styles.emptyText}>No saved articles yet.</Text>
        </View>
      ) : (
        <FlatList
          data={savedArticles}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  listContainer: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#1e1e1e',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f2f2f2',
    marginBottom: 8,
  },
  summary: {
    fontSize: 14,
    color: '#a0a0a0',
    lineHeight: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#888',
    marginTop: 16,
    fontSize: 16,
  }
});
