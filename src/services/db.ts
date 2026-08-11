import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';

export interface Material {
  id: string;
  title: string;
  topic?: string;
  type: 'PDF' | 'YouTube' | 'PPT' | 'Text';
  source: string;
  uploadDate: number;
}

export interface Question {
  id: string;
  materialId: string;
  text: string;
  options: string[];
  correctAnswer: string;
  rationale?: string;
  reference?: {
    pageNumber?: number;
    timestampSeconds?: number;
  };
}

export interface SRSCard {
  id: string;
  questionId: string;
  nextReviewDate: number;
  interval: number; // in days
  easeFactor: number;
  repetitions: number;
}

export interface LearningGap {
  id: string; // we will use questionId as the id
  conceptOrQuestionId: string;
  errorCount: number;
  masteryStatus: 'Novice' | 'Learning' | 'Mastered';
  lastRemediation?: string;
}

export interface ActivityLog {
  dateString: string; // format YYYY-MM-DD
  questionsAnswered: number;
  studyTimeSeconds?: number;
}

export interface AppSetting {
  id: string;
  value: any;
}

export interface StudyCompanionDB extends DBSchema {
  materials: {
    key: string;
    value: Material;
  };
  questions: {
    key: string;
    value: Question;
    indexes: { 'by-materialId': string };
  };
  srs_cards: {
    key: string;
    value: SRSCard;
    indexes: { 'by-nextReviewDate': number, 'by-questionId': string };
  };
  learning_gaps: {
    key: string;
    value: LearningGap;
  };
  activity_logs: {
    key: string;
    value: ActivityLog;
  };
  settings: {
    key: string;
    value: AppSetting;
  };
  material_files: {
    key: string;
    value: Blob; // To store the original file
  };
}

const DB_NAME = 'StudyCompanionDB';
const DB_VERSION = 5;

export async function initDB(): Promise<IDBPDatabase<StudyCompanionDB>> {
  return await openDB<StudyCompanionDB>(DB_NAME, DB_VERSION, {
    upgrade(db, _oldVersion, _newVersion, transaction) {
      if (!db.objectStoreNames.contains('materials')) {
        db.createObjectStore('materials', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('questions')) {
        const questionStore = db.createObjectStore('questions', { keyPath: 'id' });
        questionStore.createIndex('by-materialId', 'materialId');
      }
      if (!db.objectStoreNames.contains('srs_cards')) {
        const srsStore = db.createObjectStore('srs_cards', { keyPath: 'id' });
        srsStore.createIndex('by-nextReviewDate', 'nextReviewDate');
        srsStore.createIndex('by-questionId', 'questionId');
      } else {
        // Migration for nextReviewDate index if missing
        const srsStore = transaction.objectStore('srs_cards');
        if (!srsStore.indexNames.contains('by-nextReviewDate')) {
          srsStore.createIndex('by-nextReviewDate', 'nextReviewDate');
        }
        if (!srsStore.indexNames.contains('by-questionId')) {
          srsStore.createIndex('by-questionId', 'questionId');
        }
      }
      if (!db.objectStoreNames.contains('learning_gaps')) {
        db.createObjectStore('learning_gaps', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('activity_logs')) {
        db.createObjectStore('activity_logs', { keyPath: 'dateString' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('material_files')) {
        // We use out-of-line keys (the materialId) instead of a keyPath
        db.createObjectStore('material_files');
      }
    },
  });
}

// ==========================================
// CRUD Services
// ==========================================

export async function saveMaterial(material: Material): Promise<void> {
  const db = await initDB();
  await db.put('materials', material);
}

export async function deleteMaterialData(materialId: string) {
  const db = await initDB();
  const tx = db.transaction(['materials', 'questions', 'srs_cards', 'material_files'], 'readwrite');
  
  await tx.objectStore('materials').delete(materialId);
  await tx.objectStore('material_files').delete(materialId).catch(() => {}); // Optional catch in case it doesn't exist
  
  // Find and delete all questions for this material, including associated SRS/gaps
  const questions = await getQuestionsByMaterial(materialId);
  for (const q of questions) {
    await deleteQuestion(q.id);
  }
}

export async function getMaterials(): Promise<Material[]> {
  const db = await initDB();
  return await db.getAll('materials');
}

export async function saveMaterialFile(materialId: string, fileBlob: Blob) {
  const db = await initDB();
  await db.put('material_files', fileBlob, materialId);
}

export async function getMaterialFile(materialId: string): Promise<Blob | undefined> {
  const db = await initDB();
  return await db.get('material_files', materialId);
}

// ========================
// Questions
// ========================
export async function bulkSaveQuestions(questions: Question[]): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('questions', 'readwrite');
  for (const question of questions) {
    void tx.store.put(question);
  }
  await tx.done;
}

export async function addQuestion(question: Question): Promise<void> {
  const db = await initDB();
  await db.put('questions', question);
}

export async function updateQuestion(question: Question): Promise<void> {
  const db = await initDB();
  await db.put('questions', question);
}

export async function deleteQuestion(id: string): Promise<void> {
  const db = await initDB();
  // Delete the question
  await db.delete('questions', id);
  // Also delete associated SRS cards and gaps
  const tx = db.transaction(['srs_cards', 'learning_gaps'], 'readwrite');
  const srsCard = await tx.objectStore('srs_cards').index('by-questionId').get(id);
  if (srsCard) {
    await tx.objectStore('srs_cards').delete(srsCard.id);
  }
  await tx.objectStore('learning_gaps').delete(id); // learning gap ID matches question ID
  await tx.done;
}

export async function getQuestionsByMaterial(materialId: string): Promise<Question[]> {
  const db = await initDB();
  return await db.getAllFromIndex('questions', 'by-materialId', materialId);
}

export async function getQuestionById(id: string): Promise<Question | undefined> {
  const db = await initDB();
  return await db.get('questions', id);
}

export async function getAllQuestions(): Promise<Question[]> {
  const db = await initDB();
  return await db.getAll('questions');
}

export async function updateSRSCard(card: SRSCard): Promise<void> {
  const db = await initDB();
  await db.put('srs_cards', card);
}

export async function getSRSCardByQuestionId(questionId: string): Promise<SRSCard | undefined> {
  const db = await initDB();
  return await db.getFromIndex('srs_cards', 'by-questionId', questionId);
}

export async function getDueSRSCards(currentDate: number): Promise<SRSCard[]> {
  const db = await initDB();
  const range = IDBKeyRange.upperBound(currentDate);
  return await db.getAllFromIndex('srs_cards', 'by-nextReviewDate', range);
}

export async function saveLearningGap(gap: LearningGap): Promise<void> {
  const db = await initDB();
  await db.put('learning_gaps', gap);
}

export async function getLearningGap(id: string): Promise<LearningGap | undefined> {
  const db = await initDB();
  return await db.get('learning_gaps', id);
}

export async function getAllLearningGaps(): Promise<LearningGap[]> {
  const db = await initDB();
  return await db.getAll('learning_gaps');
}

// Activity Logs
export async function logActivity(questionsDelta = 1, timeDeltaSeconds = 0): Promise<void> {
  const db = await initDB();
  const dateString = new Date().toISOString().split('T')[0];
  const currentLog = await db.get('activity_logs', dateString);
  if (currentLog) {
    currentLog.questionsAnswered += questionsDelta;
    currentLog.studyTimeSeconds = (currentLog.studyTimeSeconds || 0) + timeDeltaSeconds;
    await db.put('activity_logs', currentLog);
  } else {
    await db.put('activity_logs', { dateString, questionsAnswered: questionsDelta, studyTimeSeconds: timeDeltaSeconds });
  }
}

export async function getActivityLogs(): Promise<ActivityLog[]> {
  const db = await initDB();
  return await db.getAll('activity_logs');
}

// Data Portability
export async function exportBackupData(): Promise<string> {
  const db = await initDB();
  const data = {
    materials: await db.getAll('materials'),
    questions: await db.getAll('questions'),
    srs_cards: await db.getAll('srs_cards'),
    learning_gaps: await db.getAll('learning_gaps'),
    activity_logs: await db.getAll('activity_logs'),
  };
  return JSON.stringify(data);
}

export async function importBackupData(jsonString: string): Promise<void> {
  const data = JSON.parse(jsonString);
  const db = await initDB();
  const tx = db.transaction(['materials', 'questions', 'srs_cards', 'learning_gaps', 'activity_logs', 'settings'], 'readwrite');
  
  // Clear existing
  await tx.objectStore('materials').clear();
  await tx.objectStore('questions').clear();
  await tx.objectStore('srs_cards').clear();
  await tx.objectStore('learning_gaps').clear();
  await tx.objectStore('activity_logs').clear();
  await tx.objectStore('settings').clear();

  // Load new
  for (const item of (data.materials || [])) await tx.objectStore('materials').put(item);
  for (const item of (data.questions || [])) await tx.objectStore('questions').put(item);
  for (const item of (data.srs_cards || [])) await tx.objectStore('srs_cards').put(item);
  for (const item of (data.learning_gaps || [])) await tx.objectStore('learning_gaps').put(item);
  for (const item of (data.activity_logs || [])) await tx.objectStore('activity_logs').put(item);
  for (const item of (data.settings || [])) await tx.objectStore('settings').put(item);

  await tx.done;
}

export async function getSetting(id: string): Promise<AppSetting | undefined> {
  const db = await initDB();
  return await db.get('settings', id);
}

export async function saveSetting(setting: AppSetting): Promise<void> {
  const db = await initDB();
  await db.put('settings', setting);
}
