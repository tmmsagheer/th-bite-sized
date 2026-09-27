import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Linking, useWindowDimensions, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import ViewShot from 'react-native-view-shot';
import * as ImageManipulator from 'expo-image-manipulator';

type Article = {
  id: string;
  title: string;
  summary: string;
  original_url: string;
  published_at: string;
};

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(true); // From library, so likely saved

  // Bug Report State
  const viewShotRef = useRef<any>(null);
  const [isReportModalVisible, setReportModalVisible] = useState(false);
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [reportComment, setReportComment] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  useEffect(() => {
    fetchArticle();
    fetchInteractions();
  }, [id]);

  const fetchArticle = async () => {
    const { data } = await supabase.from('articles').select('*').eq('id', id).single();
    if (data) setArticle(data);
    setLoading(false);
  };

  const fetchInteractions = async () => {
    const userId = '00000000-0000-0000-0000-000000000000';
    const { data } = await supabase
      .from('user_interactions')
      .select('is_liked, is_bookmarked')
      .eq('user_id', userId)
      .eq('article_id', id)
      .single();
      
    if (data) {
      setIsLiked(data.is_liked);
      setIsSaved(data.is_bookmarked);
    }
  };

  const toggleInteraction = async (type: 'like' | 'bookmark') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const userId = '00000000-0000-0000-0000-000000000000';
    
    let newLiked = isLiked;
    let newSaved = isSaved;
    
    if (type === 'like') {
      newLiked = !isLiked;
      setIsLiked(newLiked);
    } else {
      newSaved = !isSaved;
      setIsSaved(newSaved);
    }

    await supabase
      .from('user_interactions')
      .upsert([{ 
        user_id: userId, 
        article_id: id, 
        is_liked: newLiked,
        is_bookmarked: newSaved
      }], { onConflict: 'user_id,article_id' });
  };

  const captureAndReport = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      const uri = await viewShotRef.current.capture();
      // Compress the screenshot before saving it to DB
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800 } }], // Compress width to 800px
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      
      setScreenshotUri(manipResult.base64 || null);
      setReportComment('');
      setReportModalVisible(true);
    } catch (err) {
      console.error('Error capturing screenshot', err);
      Alert.alert('Error', 'Could not capture screenshot for bug report.');
    }
  };

  const submitBugReport = async () => {
    if (isSubmittingReport) return;
    setIsSubmittingReport(true);
    Keyboard.dismiss();

    try {
      const { error } = await supabase
        .from('bug_reports')
        .insert([{
          article_id: id,
          user_comment: reportComment,
          screenshot_base64: screenshotUri
        }]);

      if (error) throw error;
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setReportModalVisible(false);
      Alert.alert('Report Submitted', 'Thank you for reporting this issue!');
    } catch (err) {
      console.error('Failed to submit bug report', err);
      Alert.alert('Error', 'Could not save the bug report. Please try again later.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  if (loading || !article) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <ViewShot ref={viewShotRef} style={[styles.container, { flex: 1, width }]} options={{ format: "jpg", quality: 0.8 }}>
      <SafeAreaView style={styles.safeArea}>
        
        {/* Top Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="close" size={32} color="#fff" />
        </TouchableOpacity>

        <View style={styles.contentContainer}>
          <View style={styles.titleContainer}>
            <Text 
              style={[styles.title, { fontSize: article.title.length > 80 ? 26 : 34 }]} 
              numberOfLines={4}
            >
              {article.title}
            </Text>
            <Text style={styles.date}>
              {article.published_at ? new Date(article.published_at).toLocaleDateString() : 'Recent'}
            </Text>
          </View>
          
          <View style={styles.summaryContainer}>
            <Text 
              style={[styles.summary, { fontSize: article.summary.length > 500 ? 18 : 22 }]} 
              numberOfLines={14}
            >
              {article.summary}
            </Text>
          </View>
        </View>

        {/* Bottom Actions Row */}
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.actionBubble} onPress={() => toggleInteraction('like')}>
            <Ionicons name={isLiked ? "heart" : "heart-outline"} size={28} color={isLiked ? "#ff3b30" : "#fff"} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionBubble} onPress={() => toggleInteraction('bookmark')}>
            <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={26} color={isSaved ? "#007aff" : "#fff"} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBubble} onPress={() => {
            Haptics.selectionAsync();
            Linking.openURL(article.original_url);
          }}>
            <Ionicons name="link" size={28} color="#34c759" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBubble} onPress={captureAndReport}>
            <Ionicons name="warning-outline" size={24} color="#ffcc00" />
          </TouchableOpacity>
        </View>

        <LinearGradient colors={['transparent', 'rgba(18,18,18,1)']} style={styles.bottomGradient} pointerEvents="none" />
      </SafeAreaView>

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
              <TouchableOpacity style={styles.modalSubmit} onPress={submitBugReport} disabled={isSubmittingReport}>
                {isSubmittingReport ? (
                  <ActivityIndicator color="#fff" />
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
    backgroundColor: '#121212',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  safeArea: {
    flex: 1,
    flexDirection: 'column',
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    paddingBottom: 90,
    zIndex: 2, 
  },
  titleContainer: {
    marginBottom: 20,
    maxHeight: '40%',
  },
  summaryContainer: {
    flex: 1,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1e1e1e',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 16,
  },
  textInput: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
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
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalCancelText: {
    color: '#ff4444',
    fontSize: 16,
    fontWeight: '600',
  },
  modalSubmit: {
    backgroundColor: '#34c759',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalSubmitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
