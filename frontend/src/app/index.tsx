import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Linking, useWindowDimensions, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, Keyboard, Animated, PanResponder } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import ViewShot from 'react-native-view-shot';
import * as ImageManipulator from 'expo-image-manipulator';
import ConfettiCannon from 'react-native-confetti-cannon';

type Article = {
  id: string;
  title: string;
  summary: string;
  category: string;
  original_url: string;
  published_at: string;
};

export default function FeedScreen() {
  const { height, width } = useWindowDimensions();
  const { viewArticleId } = useLocalSearchParams<{ viewArticleId?: string }>();
  
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  const INITIAL_PAGE_SIZE = 10;
  const FETCH_MORE_SIZE = 5;

  // Local state maps for instant UI feedback (now supporting toggle)
  const [likedArticles, setLikedArticles] = useState<Record<string, boolean>>({});
  const [savedArticles, setSavedArticles] = useState<Record<string, boolean>>({});

  // Bug Report State
  const viewShotRef = useRef<any>(null);
  const [isReportModalVisible, setReportModalVisible] = useState(false);
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [reportComment, setReportComment] = useState('');
  const [reportingArticleId, setReportingArticleId] = useState<string | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // FlatList Ref for programmatic scrolling
  const flatListRef = useRef<FlatList>(null);

  // Floating button pan responder
  const pan = useRef(new Animated.ValueXY()).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only become responder if moving, otherwise allow tap to propagate
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      },
    })
  ).current;

  useEffect(() => {
    fetchArticles();
  }, []);

  // (Deep link logic removed in favor of standalone article screens)

  const fetchUserInteractions = async (articleIds: string[]) => {
    const userId = '00000000-0000-0000-0000-000000000000';
    const { data } = await supabase
      .from('user_interactions')
      .select('article_id, is_liked, is_bookmarked')
      .eq('user_id', userId)
      .in('article_id', articleIds);
      
    if (data) {
      const liked: Record<string, boolean> = {};
      const saved: Record<string, boolean> = {};
      data.forEach(interaction => {
        if (interaction.is_liked) liked[interaction.article_id] = true;
        if (interaction.is_bookmarked) saved[interaction.article_id] = true;
      });
      setLikedArticles(prev => ({ ...prev, ...liked }));
      setSavedArticles(prev => ({ ...prev, ...saved }));
    }
  };

  const fetchArticles = async () => {
    try {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('status', 'success')
        .order('published_at', { ascending: false })
        .range(0, INITIAL_PAGE_SIZE - 1);

      if (error) throw error;
      setArticles(data || []);
      setHasMore(data?.length === INITIAL_PAGE_SIZE);
      
      if (data && data.length > 0) {
        fetchUserInteractions(data.map(a => a.id));
      }
    } catch (error) {
      console.error('Error fetching articles:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMoreArticles = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);

    try {
      const from = articles.length;
      const to = from + FETCH_MORE_SIZE - 1;

      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('status', 'success')
        .order('published_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      if (data && data.length > 0) {
        setArticles(prev => {
          const existingIds = new Set(prev.map(a => a.id));
          const newArticles = data.filter(a => !existingIds.has(a.id));
          return [...prev, ...newArticles];
        });
        setHasMore(data.length === FETCH_MORE_SIZE);
        fetchUserInteractions(data.map(a => a.id));
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error fetching more articles:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleInteraction = async (articleId: string, interactionType: 'like' | 'dislike' | 'bookmark', index: number) => {
    // Must be a valid UUID to match DB schema
    const userId = '00000000-0000-0000-0000-000000000000';
    
    const newIsLiked = interactionType === 'like' ? !likedArticles[articleId] : likedArticles[articleId];
    const newIsSaved = interactionType === 'bookmark' ? !savedArticles[articleId] : savedArticles[articleId];
    
    // 1. Instant Haptic Feedback & UI State Update
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (interactionType === 'like') {
      setLikedArticles(prev => ({ ...prev, [articleId]: newIsLiked }));
    } else if (interactionType === 'bookmark') {
      setSavedArticles(prev => ({ ...prev, [articleId]: newIsSaved }));
    } else if (interactionType === 'dislike') {
      // Auto-scroll to next article
      if (index < articles.length - 1) {
        const offset = (listHeight || height) * (index + 1);
        flatListRef.current?.scrollToOffset({ offset, animated: true });
      }
    }

    // 2. Background Sync
    try {
      await supabase
        .from('user_interactions')
        .upsert([{ 
          user_id: userId, 
          article_id: articleId, 
          is_liked: newIsLiked || false,
          is_disliked: interactionType === 'dislike',
          is_bookmarked: newIsSaved || false
        }], { onConflict: 'user_id,article_id' });
    } catch (error) {
      console.error('Error recording interaction:', error);
    }
  };

  const captureAndReport = async (articleId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReportingArticleId(articleId);
    
    try {
      if (viewShotRef.current?.capture) {
        const uri = await viewShotRef.current.capture();
        
        // Compress screenshot to base64
        const manipResult = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 600 } }],
          { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        
        setScreenshotUri(`data:image/jpeg;base64,${manipResult.base64}`);
        setReportModalVisible(true);
      }
    } catch (err) {
      Alert.alert('Screenshot Failed', 'Unable to capture the screen.');
    }
  };

  const submitReport = async () => {
    if (!screenshotUri || !reportingArticleId) return;
    setIsSubmittingReport(true);
    Keyboard.dismiss();

    try {
      const { error } = await supabase
        .from('bug_reports')
        .insert([{
          article_id: reportingArticleId,
          user_comment: reportComment,
          screenshot_base64: screenshotUri
        }]);

      if (error) throw error;
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Report Sent', 'Thank you for helping us improve!');
      
    } catch (err: any) {
      console.error('Bug Report Error:', err);
      Alert.alert('Upload Failed', err.message || 'Could not save the bug report.');
    } finally {
      setIsSubmittingReport(false);
      setReportModalVisible(false);
      setReportComment('');
      setScreenshotUri(null);
    }
  };

  const renderItem = ({ item, index, listHeight, width }: { item: Article, index: number, listHeight: number, width: number }) => {
    const isLiked = likedArticles[item.id];
    const isSaved = savedArticles[item.id];

    return (
      <View style={[styles.card, { height: listHeight, width }]}>
        <SafeAreaView style={styles.safeArea}>
          {/* Floating Top Bar (Draggable Library Link) */}
          <Animated.View 
            style={[
              styles.topBar, 
              { transform: [{ translateX: pan.x }, { translateY: pan.y }] }
            ]}
            {...panResponder.panHandlers}
          >
            <Link href="/library" asChild>
              <TouchableOpacity 
                style={styles.topBarButton} 
                onPress={() => Haptics.selectionAsync()}
              >
                <Ionicons name="library" size={24} color="#fff" />
              </TouchableOpacity>
            </Link>
          </Animated.View>
          
          {/* Main Content Area */}
          <View style={styles.contentContainer}>
            {/* Title container that flexes and shrinks text to fit */}
            <View style={styles.titleContainer}>
              <Text 
                style={[styles.title, { fontSize: item.title.length > 80 ? 26 : 34 }]} 
                numberOfLines={4}
              >
                {item.title}
              </Text>
              <Text style={styles.date}>
                {item.published_at ? new Date(item.published_at).toLocaleDateString() : 'Recent'}
              </Text>
            </View>
            
            {/* Summary container that flexibly takes remaining space */}
            <View style={styles.summaryContainer}>
              <Text 
                style={[styles.summary, { fontSize: item.summary.length > 500 ? 18 : 22 }]} 
                numberOfLines={14}
              >
                {item.summary}
              </Text>
            </View>
          </View>

          {/* Bottom Actions Row */}
          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.actionBubble} onPress={() => handleInteraction(item.id, 'like', index)}>
              <Ionicons name={isLiked ? "heart" : "heart-outline"} size={28} color={isLiked ? "#ff3b30" : "#fff"} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionBubble} onPress={() => handleInteraction(item.id, 'dislike', index)}>
              <Ionicons name="close" size={32} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionBubble} onPress={() => handleInteraction(item.id, 'bookmark', index)}>
              <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={26} color={isSaved ? "#007aff" : "#fff"} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBubble} onPress={() => {
              Haptics.selectionAsync();
              Linking.openURL(item.original_url);
            }}>
              <Ionicons name="link" size={28} color="#34c759" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBubble} onPress={() => captureAndReport(item.id)}>
              <Ionicons name="warning-outline" size={24} color="#ffcc00" />
            </TouchableOpacity>
          </View>

          {/* Bottom Gradient behind the buttons */}
          <LinearGradient
            colors={['transparent', 'rgba(18,18,18,1)']}
            style={styles.bottomGradient}
            pointerEvents="none"
          />
        </SafeAreaView>
      </View>
    );
  };

  const [listHeight, setListHeight] = useState(0);

  if (loading || listHeight === 0) {
    return (
      <View style={styles.loadingContainer} onLayout={(e) => setListHeight(e.nativeEvent.layout.height)}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading feed...</Text>
      </View>
    );
  }

  const renderFooter = () => {
    // Only show the footer if we have successfully loaded all articles
    if (hasMore || articles.length === 0) return null;

    return (
      <View style={[styles.card, { height: listHeight, width, justifyContent: 'center', alignItems: 'center' }]}>
        <ConfettiCannon
          count={150}
          origin={{ x: width / 2, y: -50 }}
          autoStart={true}
          fadeOut={true}
          fallSpeed={2500}
          colors={['#ffcc00', '#ff3b30', '#34c759', '#007aff', '#ff9500']}
        />
        
        <Ionicons name="sparkles" size={80} color="#ffcc00" style={{ marginBottom: 30 }} />
        <Text style={[styles.title, { textAlign: 'center', fontSize: 32, paddingHorizontal: 40 }]}>
          You're all caught up!
        </Text>
        <Text style={[styles.summary, { textAlign: 'center', marginTop: 20, paddingHorizontal: 40, fontSize: 20 }]}>
          Try again after 6 hours for new news articles.
        </Text>
      </View>
    );
  };

  return (
    <ViewShot ref={viewShotRef} style={styles.container} options={{ format: "jpg", quality: 0.8 }}>
      <FlatList
        ref={flatListRef}
        data={articles}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item, index }) => renderItem({ item, index, listHeight, width })}
        getItemLayout={(data, index) => (
          { length: listHeight, offset: listHeight * index, index }
        )}
        onEndReached={fetchMoreArticles}
        onEndReachedThreshold={5}
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews={true}
        ListFooterComponent={renderFooter}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToAlignment="start"
        decelerationRate="fast"
      />

      {/* Report Bug Modal */}
      <Modal visible={isReportModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Report an Issue</Text>
            <Text style={styles.modalSubtitle}>A screenshot has been automatically captured.</Text>
            
            <TextInput
              style={styles.textInput}
              placeholder="What went wrong? (Optional)"
              placeholderTextColor="#888"
              multiline
              value={reportComment}
              onChangeText={setReportComment}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setReportModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.modalSubmit} onPress={submitReport} disabled={isSubmittingReport}>
                {isSubmittingReport ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSubmitText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ViewShot>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600'
  },
  card: {
    backgroundColor: '#121212',
    overflow: 'hidden', // Enforces strict clipping so text doesn't bleed
  },
  safeArea: {
    flex: 1,
    flexDirection: 'column', // Changed to column so bottom bar sits below text
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center', // Center vertically
    paddingBottom: 90, // Leave room for bottom bar
    zIndex: 2, 
  },
  titleContainer: {
    marginBottom: 20,
    maxHeight: '40%', // Title shouldn't take more than 40% of screen
  },
  summaryContainer: {
    flex: 1, // Summary takes remaining space
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    color: '#f2f2f2',
    lineHeight: 40,
    marginBottom: 8,
  },
  date: {
    fontSize: 14,
    color: '#a0a0a0',
    fontWeight: '600'
  },
  summary: {
    fontSize: 22,
    lineHeight: 34,
    color: '#d1d1d1',
    fontWeight: '400',
  },
  topBar: {
    position: 'absolute',
    top: 32,
    right: 20,
    zIndex: 10,
  },
  topBarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    zIndex: 3,
  },
  actionBubble: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)'
  },
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
    zIndex: 1,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1e1e1e',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#333'
  },
  modalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalSubtitle: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 20,
  },
  textInput: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    borderRadius: 8,
    padding: 16,
    height: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancel: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalCancelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  modalSubmit: {
    backgroundColor: '#007aff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  modalSubmitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  }
});
