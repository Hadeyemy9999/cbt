// --- FIREBASE IMPORTS (Conditional Use) ---
// These imports are only used if the application is run within the designated Canvas environment.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, updateDoc, serverTimestamp, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- GLOBAL CONSTANTS ---
// Define the base subjects that are always included in the exam.
const FIXED_SUBJECTS = ['MATHS', 'ENGLISH', 'GENERAL']; 
const TOTAL_QUESTIONS_COUNT = 50; 
const MAX_TIME_SECONDS = 30 * 60; // 30 minutes converted to seconds.

// Define the required question count for each subject category to hit 50 questions.
const QUESTIONS_PER_SUBJECT_MAP = {
    MATHS: 13,
    ENGLISH: 13,
    GENERAL: 12,
    DEPARTMENTAL: 12
};

// --- FIREBASE AND STATE VARIABLES ---
let app, db, auth;
let userId = ''; 
let isFirebaseActive = false; // Flag to track if Firebase is successfully initialized

// Application state variables
let currentQuestionIndex = 0; 
let examQuestions = []; 
let userAnswers = {}; 
let timerInterval; 
let timeRemaining = MAX_TIME_SECONDS;
let candidateName = '';
let selectedDepartment = '';

// Global Firebase variables provided by the environment (will be undefined in local run)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- DOM ELEMENT REFERENCES ---
const startScreen = document.getElementById('start-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const examScreen = document.getElementById('exam-screen');
const resultsScreen = document.getElementById('results-screen');
const loadingSpinner = document.getElementById('loading-spinner');
const nameInput = document.getElementById('name-input');
const startButton = document.getElementById('start-button');
const departmentSelect = document.getElementById('department-select');
const confirmationModal = document.getElementById('confirmation-modal');
// Removed: const confirmStartButton = document.getElementById('confirm-start-button'); // This ID is NOT IN THE HTML


// --- QUESTION DATA (New 4-Subject Structure) ---
// NOTE: I1-I50 were used for Immigration in the previous correct list, so I'm using N1-N50 for Correctional 
// and C1-C50, F1-F50 for the others to maintain distinct IDs.
const fullQuestionsData = [
    // --- MATHEMATICS (13 Questions Pool) ---
    {
        "id": "M1",
        "subject": "MATHS",
        "q": "Simplify: $2x + 3x - 4$",
        "options": {
            "A": "$5x - 4$",
            "B": "$x - 4$",
            "C": "$4x - 4$",
            "D": "$5x + 4$"
        },
        "ans": "A",
        "exp": "Combine like terms: $2x + 3x = 5x$, so result is $5x - 4$."
    },
    {
        "id": "M2",
        "subject": "MATHS",
        "q": "Solve for $x$: $2x + 5 = 11$",
        "options": {
            "A": "$x = 2$",
            "B": "$x = 3$",
            "C": "$x = 4$",
            "D": "$x = 5$"
        },
        "ans": "B",
        "exp": "Subtract 5 from both sides: $2x = 6$, divide by 2: $x = 3$."
    },
    {
        "id": "M3",
        "subject": "MATHS",
        "q": "Expand: $(x + 2)(x + 3)$",
        "options": {
            "A": "$x^2 + 5x + 6$",
            "B": "$x^2 + 6x + 5$",
            "C": "$x^2 + 2x + 3$",
            "D": "$x^2 + 3x + 2$"
        },
        "ans": "A",
        "exp": "Use distributive law: $x(x+3) + 2(x+3) = x^2 + 5x + 6$."
    },
    {
        "id": "M4",
        "subject": "MATHS",
        "q": "Factorize: $x^2 + 7x + 10$",
        "options": {
            "A": "$(x + 2)(x + 5)$",
            "B": "$(x + 1)(x + 10)$",
            "C": "$(x - 2)(x + 5)$",
            "D": "$(x + 10)(x - 1)$"
        },
        "ans": "A",
        "exp": "Find two numbers that multiply to 10 and add to 7 \u2192 2 and 5."
    },
    {
        "id": "M5",
        "subject": "MATHS",
        "q": "Simplify: $3x + 5y - x + 2y$",
        "options": {
            "A": "$4x + 7y$",
            "B": "$2x + 7y$",
            "C": "$4x + 3y$",
            "D": "$2x + 3y$"
        },
        "ans": "B",
        "exp": "Combine like terms: $(3x - x) + (5y + 2y) = 2x + 7y$."
    },
    {
        "id": "M6",
        "subject": "MATHS",
        "q": "Find the value: $15 + 8 \\times 2$",
        "options": {
            "A": "$46$",
            "B": "$31$",
            "C": "$23$",
            "D": "$30$"
        },
        "ans": "B",
        "exp": "Use BODMAS: $8 \\times 2 = 16$, then $15 + 16 = 31$."
    },
    {
        "id": "M7",
        "subject": "MATHS",
        "q": "What is 25% of 200?",
        "options": {
            "A": "$25$",
            "B": "$50$",
            "C": "$75$",
            "D": "$100$"
        },
        "ans": "B",
        "exp": "25% of 200 = $\\frac{25}{100} \\times 200 = 50$."
    },
    {
        "id": "M8",
        "subject": "MATHS",
        "q": "Simplify: $3^2 + 4^2$",
        "options": {
            "A": "$12$",
            "B": "$25$",
            "C": "$7$",
            "D": "$9$"
        },
        "ans": "B",
        "exp": "Compute squares: $3^2 = 9$, $4^2 = 16$, sum = 25."
    },
    {
        "id": "M9",
        "subject": "MATHS",
        "q": "Convert 0.75 to a fraction.",
        "options": {
            "A": "$\\frac{1}{4}$",
            "B": "$\\frac{2}{3}$",
            "C": "$\\frac{3}{4}$",
            "D": "$\\frac{4}{5}$"
        },
        "ans": "C",
        "exp": "$0.75 = \\frac{75}{100} = \\frac{3}{4}$."
    },
    {
        "id": "M10",
        "subject": "MATHS",
        "q": "Find the LCM of 6 and 8.",
        "options": {
            "A": "$12$",
            "B": "$24$",
            "C": "$18$",
            "D": "$30$"
        },
        "ans": "B",
        "exp": "LCM of 6 and 8 = $24$."
    },
    {
        "id": "M11",
        "subject": "MATHS",
        "q": "Simplify: $\\frac{3}{4} + \\frac{2}{4}$",
        "options": {
            "A": "$\\frac{5}{4}$",
            "B": "$\\frac{1}{2}$",
            "C": "$\\frac{3}{2}$",
            "D": "$\\frac{1}{4}$"
        },
        "ans": "A",
        "exp": "Same denominator: $3 + 2 = 5$, so $\\frac{5}{4}$."
    },
    {
        "id": "M12",
        "subject": "MATHS",
        "q": "Simplify: $\\frac{5}{6} - \\frac{1}{3}$",
        "options": {
            "A": "$\\frac{4}{6}$",
            "B": "$\\frac{1}{2}$",
            "C": "$\\frac{1}{4}$",
            "D": "$\\frac{1}{6}$"
        },
        "ans": "B",
        "exp": "Convert $\\frac{1}{3}$ to $\\frac{2}{6}$, subtract: $\\frac{5}{6} - \\frac{2}{6} = \\frac{3}{6} = \\frac{1}{2}$."
    },
    {
        "id": "M13",
        "subject": "MATHS",
        "q": "Multiply: $\\frac{2}{3} \\times \\frac{3}{5}$",
        "options": {
            "A": "$\\frac{6}{15}$",
            "B": "$\\frac{2}{5}$",
            "C": "$\\frac{3}{8}$",
            "D": "$\\frac{1}{5}$"
        },
        "ans": "B",
        "exp": "Multiply numerators and denominators: $2 \\times 3 = 6$, $3 \\times 5 = 15$. $\\frac{6}{15}$ simplifies to $\\frac{2}{5}$."
    },
    // --- ENGLISH LANGUAGE (13 Questions Pool) ---
    {
        "id": "E1",
        "subject": "ENGLISH",
        "q": "Choose the correct verb form: She ____ to the store yesterday.",
        "options": {
            "A": "go",
            "B": "went",
            "C": "gone",
            "D": "going"
        },
        "ans": "B",
        "exp": "Past action: use past tense 'went'."
    },
    {
        "id": "E2",
        "subject": "ENGLISH",
        "q": "Identify the sentence with correct subject\u2013verb agreement: 'The team ____ ready.'",
        "options": {
            "A": "is",
            "B": "are",
            "C": "were",
            "D": "be"
        },
        "ans": "A",
        "exp": "'Team' as a collective noun here takes singular verb 'is'."
    },
    {
        "id": "E3",
        "subject": "ENGLISH",
        "q": "Choose the correct modal: You ____ finish your homework before you play.",
        "options": {
            "A": "must",
            "B": "might",
            "C": "would",
            "D": "shouldn't"
        },
        "ans": "A",
        "exp": "'Must' shows obligation - best fit for requirement."
    },
    {
        "id": "E4",
        "subject": "ENGLISH",
        "q": "Select the correct tense: By next year, I ____ my degree.",
        "options": {
            "A": "complete",
            "B": "will complete",
            "C": "will have completed",
            "D": "completed"
        },
        "ans": "C",
        "exp": "Future perfect 'will have completed' for an action finished before a time."
    },
    {
        "id": "E5",
        "subject": "ENGLISH",
        "q": "Choose the correct conditional: If I ____ you, I would apologize.",
        "options": {
            "A": "am",
            "B": "were",
            "C": "was",
            "D": "be"
        },
        "ans": "B",
        "exp": "Second conditional uses 'were' for hypothetical situations."
    },
    {
        "id": "E6",
        "subject": "ENGLISH",
        "q": "Choose the closest meaning of 'mitigate'.",
        "options": {
            "A": "worsen",
            "B": "alleviate",
            "C": "ignore",
            "D": "celebrate"
        },
        "ans": "B",
        "exp": "'Mitigate' means to make less severe; 'alleviate'."
    },
    {
        "id": "E7",
        "subject": "ENGLISH",
        "q": "Select the antonym of 'scarce'.",
        "options": {
            "A": "rare",
            "B": "limited",
            "C": "abundant",
            "D": "insufficient"
        },
        "ans": "C",
        "exp": "Antonym of 'scarce' is 'abundant'."
    },
    {
        "id": "E8",
        "subject": "ENGLISH",
        "q": "Select the synonym of 'obstinate'.",
        "options": {
            "A": "flexible",
            "B": "stubborn",
            "C": "timid",
            "D": "friendly"
        },
        "ans": "B",
        "exp": "'Obstinate' = 'stubborn'."
    },
    {
        "id": "E9",
        "subject": "ENGLISH",
        "q": "Choose the word that best fits: The speech was so ____ that many people cried.",
        "options": {
            "A": "insipid",
            "B": "moving",
            "C": "tedious",
            "D": "mundane"
        },
        "ans": "B",
        "exp": "'Moving' means emotionally touching."
    },
    {
        "id": "E10",
        "subject": "ENGLISH",
        "q": "Identify the figure of speech: 'The wind whispered through the trees.'",
        "options": {
            "A": "Metaphor",
            "B": "Simile",
            "C": "Personification",
            "D": "Alliteration"
        },
        "ans": "C",
        "exp": "Giving human qualities to wind = personification."
    },
    {
        "id": "E11",
        "subject": "ENGLISH",
        "q": "What is this: 'She is as brave as a lion.'",
        "options": {
            "A": "Hyperbole",
            "B": "Simile",
            "C": "Metonymy",
            "D": "Irony"
        },
        "ans": "B",
        "exp": "Use of 'as' compares \u2014 simile."
    },
    {
        "id": "E12",
        "subject": "ENGLISH",
        "q": "Identify the device: 'Peter Piper picked a peck of pickled peppers.'",
        "options": {
            "A": "Onomatopoeia",
            "B": "Alliteration",
            "C": "Oxymoron",
            "D": "Antithesis"
        },
        "ans": "B",
        "exp": "Repeated initial consonant sounds = alliteration."
    },
    {
        "id": "E13",
        "subject": "ENGLISH",
        "q": "What figure is: 'Time is a thief.'",
        "options": {
            "A": "Metaphor",
            "B": "Personification",
            "C": "Simile",
            "D": "Hyperbole"
        },
        "ans": "A",
        "exp": "Direct comparison without 'like' or 'as' = metaphor."
    },
    // --- GENERAL KNOWLEDGE (12 Questions Pool) ---
    {
        "id": "G1",
        "subject": "GENERAL",
        "q": "What is the largest ethnic group in Nigeria?",
        "options": {
            "A": "Igbo",
            "B": "Yoruba",
            "C": "Hausa-Fulani",
            "D": "Ijaw"
        },
        "ans": "C",
        "exp": "The Hausa-Fulani are the largest ethnic group in Nigeria."
    },
    {
        "id": "G2",
        "subject": "GENERAL",
        "q": "Who was Nigeria's first Prime Minister?",
        "options": {
            "A": "Nnamdi Azikiwe",
            "B": "Tafawa Balewa",
            "C": "Obafemi Awolowo",
            "D": "Ahmadu Bello"
        },
        "ans": "B",
        "exp": "Sir Abubakar Tafawa Balewa was Nigeria\u2019s first Prime Minister."
    },
    {
        "id": "G3",
        "subject": "GENERAL",
        "q": "Which Nigerian city is known as the \u2018Centre of Excellence\u2019?",
        "options": {
            "A": "Kano",
            "B": "Lagos",
            "C": "Enugu",
            "D": "Abuja"
        },
        "ans": "B",
        "exp": "Lagos is nicknamed the 'Centre of Excellence'."
    },
    {
        "id": "G4",
        "subject": "GENERAL",
        "q": "Who composed the Nigerian national anthem?",
        "options": {
            "A": "Benedict Odiase",
            "B": "Pa Benedict Peters",
            "C": "Wole Soyinka",
            "D": "Chinua Achebe"
        },
        "ans": "A",
        "exp": "Benedict Odiase composed the current national anthem, adopted in 1978."
    },
    {
        "id": "G5",
        "subject": "GENERAL",
        "q": "Nigeria operates what type of government system?",
        "options": {
            "A": "Monarchy",
            "B": "Parliamentary",
            "C": "Federal Republic",
            "D": "Confederation"
        },
        "ans": "C",
        "exp": "Nigeria operates a Federal Republic system of government."
    },
    {
        "id": "G6",
        "subject": "GENERAL",
        "q": "Which Nigerian state is the largest by land area?",
        "options": {
            "A": "Niger",
            "B": "Borno",
            "C": "Kano",
            "D": "Kaduna"
        },
        "ans": "A",
        "exp": "Niger State is the largest by land area in Nigeria."
    },
    {
        "id": "G7",
        "subject": "GENERAL",
        "q": "Who is the current President of Nigeria?",
        "options": {
            "A": "Bola Ahmed Tinubu",
            "B": "Muhammadu Buhari",
            "C": "Goodluck Jonathan",
            "D": "Atiku Abubakar"
        },
        "ans": "A",
        "exp": "Bola Ahmed Tinubu became Nigeria\u2019s President in May 2023."
    },
    {
        "id": "G8",
        "subject": "GENERAL",
        "q": "Which Nigerian was awarded the Nobel Prize in Literature?",
        "options": {
            "A": "Wole Soyinka",
            "B": "Chinua Achebe",
            "C": "Buchi Emecheta",
            "D": "Ben Okri"
        },
        "ans": "A",
        "exp": "Wole Soyinka won the Nobel Prize in Literature in 1986."
    },
    {
        "id": "G9",
        "subject": "GENERAL",
        "q": "In which year did Nigeria gain independence?",
        "options": {
            "A": "1957",
            "B": "1959",
            "C": "1960",
            "D": "1963"
        },
        "ans": "C",
        "exp": "Nigeria gained independence from Britain on October 1, 1960."
    },
    {
        "id": "G10",
        "subject": "GENERAL",
        "q": "What does the green color in Nigeria's flag represent?",
        "options": {
            "A": "Peace",
            "B": "Agriculture",
            "C": "Unity",
            "D": "Strength"
        },
        "ans": "B",
        "exp": "Green represents agriculture, white stands for peace."
    },
    {
        "id": "G11",
        "subject": "GENERAL",
        "q": "Which river is the longest in Nigeria?",
        "options": {
            "A": "River Niger",
            "B": "River Benue",
            "C": "Cross River",
            "D": "Ogun River"
        },
        "ans": "A",
        "exp": "River Niger is Nigeria\u2019s longest river."
    },
    {
        "id": "G12",
        "subject": "GENERAL",
        "q": "The first military coup d’état in Nigeria was in which year?",
        "options": {
            "A": "1964",
            "B": "1966",
            "C": "1960",
            "D": "1999"
        },
        "ans": "B",
        "exp": "The first military coup took place in 1966."
    },
    // --- DEPARTMENTAL QUESTIONS (12 Questions for selected focus) ---

    // NIGERIA IMMIGRATION SERVICE (NIS) - For IMMIGRATION_NIS focus
    {
        'id': 'I1',
        'subject': 'IMMIGRATION_NIS',
        'q': 'The Nigeria Immigration Service (NIS) was formally established under which Act or Edict?',
        'options': { 'A': 'Immigration Act of 1963', 'B': 'Immigration Edict of 1958', 'C': 'Customs and Excise Management Act 1956', 'D': 'Police Act 1943' },
        'ans': 'A',
        'exp': 'The NIS was formally established by the Immigration Act of 1963, succeeding the former Immigration Department.'
    },
    {
        'id': 'I2',
        'subject': 'IMMIGRATION_NIS',
        'q': 'What is the primary function of the Nigeria Immigration Service (NIS)?',
        'options': { 'A': 'Internal security patrols', 'B': 'Management of the nation\'s borders and issuance of travel documents', 'C': 'Collection of customs duties', 'D': 'Fire prevention and rescue operations' },
        'ans': 'B',
        'exp': 'The NIS is primarily responsible for border control and the issuance of passports and visas.'
    },
    {
        'id': 'I3',
        'subject': 'IMMIGRATION_NIS',
        'q': 'Who is the head of the Nigeria Immigration Service?',
        'options': { 'A': 'Inspector General of Police', 'B': 'Comptroller General of Immigration Service (CGIS)', 'C': 'Commandant General', 'D': 'Controller General of Corrections' },
        'ans': 'B',
        'exp': 'The head of the NIS is the Comptroller General of Immigration Service (CGIS).'
    },
    {
        'id': 'I4',
        'subject': 'IMMIGRATION_NIS',
        'q': 'The NIS is under the supervision of which Nigerian Federal Ministry?',
        'options': { 'A': 'Ministry of Defence', 'B': 'Ministry of Finance', 'C': 'Ministry of Interior', 'D': 'Ministry of Foreign Affairs' },
        'ans': 'C',
        'exp': 'The Nigeria Immigration Service operates under the supervision of the Federal Ministry of Interior.'
    },
    {
        'id': 'I5',
        'subject': 'IMMIGRATION_NIS',
        'q': 'Which document is the NIS responsible for issuing to Nigerians for international travel?',
        'options': { 'A': 'National ID Card', 'B': 'Drivers\' License', 'C': 'International Passport', 'D': 'Birth Certificate' },
        'ans': 'C',
        'exp': 'The NIS is solely responsible for the issuance of the Nigerian International Passport.'
    },
    {
        'id': 'I6',
        'subject': 'IMMIGRATION_NIS',
        'q': 'NIS is responsible for issuing which type of document to foreigners seeking to reside or work in Nigeria?',
        'options': { 'A': 'Tourist Permit', 'B': 'ECOWAS Travel Certificate', 'C': 'CERPAC (Combined Expatriate Residence Permit and Alien Card)', 'D': 'Student Visa' },
        'ans': 'C',
        'exp': 'The NIS issues the CERPAC as a legal document permitting expatriates to reside and work in Nigeria.'
    },
    {
        'id': 'I7',
        'subject': 'IMMIGRATION_NIS',
        'q': 'The NIS plays a crucial role in curbing which transnational crime?',
        'options': { 'A': 'Cybercrime', 'B': 'Pipeline vandalism', 'C': 'Human Trafficking and Smuggling of Migrants', 'D': 'Terrorism in the North East only' },
        'ans': 'C',
        'exp': 'Border management and control are vital in combating transnational crimes like human trafficking and migrant smuggling.'
    },
    {
        'id': 'I8',
        'subject': 'IMMIGRATION_NIS',
        'q': 'The Immigration Act CAP I1 Laws of the Federation of Nigeria, 2004, has been repealed and replaced by the:',
        'options': { 'A': 'Immigration Act 2015', 'B': 'Border Control Act 2019', 'C': 'Customs Act 2020', 'D': 'NIS Establishment Act 2011' },
        'ans': 'A',
        'exp': 'The Immigration Act 2015 is the current principal legislation governing the NIS.'
    },
    {
        'id': 'I9',
        'subject': 'IMMIGRATION_NIS',
        'q': 'What does the acronym \'NIS\' stand for?',
        'options': { 'A': 'Nigerian Internal Security', 'B': 'National Information System', 'C': 'Nigeria Immigration Service', 'D': 'Nigerian Intelligence System' },
        'ans': 'C',
        'exp': 'NIS stands for Nigeria Immigration Service.'
    },
    {
        'id': 'I10',
        'subject': 'IMMIGRATION_NIS',
        'q': 'The NIS was formally established by an Act of Parliament in which year?',
        'options': { 'A': '1963', 'B': '1957', 'C': '1964', 'D': '1976' },
        'ans': 'A',
        'exp': '1963 is listed as the formal establishment year by Act of Parliament.'
    },
    {
        'id': 'I11',
        'subject': 'IMMIGRATION_NIS',
        'q': 'Which title is correct for the head of NIS?',
        'options': { 'A': 'Controller General', 'B': 'Comptroller General', 'C': 'Commandant General', 'D': 'Major General' },
        'ans': 'B',
        'exp': 'The head of NIS holds the title Comptroller General.'
    },
    {
        'id': 'I12',
        'subject': 'IMMIGRATION_NIS',
        'q': 'What does CGIS stand for?',
        'options': { 'A': 'Comptroller General of Immigration Service', 'B': 'Central Government Immigration Service', 'C': 'Comprehensive Government Immigration System', 'D': 'Complainant General Immigration Service' },
        'ans': 'A',
        'exp': 'CGIS is an abbreviation for Comptroller General of Immigration Service.'
    },

    // FEDERAL FIRE SERVICE (FFS) - For FIRE_FFS focus
    {
        'id': 'F1',
        'subject': 'FIRE_FFS',
        'q': 'The Federal Fire Service (FFS) was established in which year?',
        'options': { 'A': '1945', 'B': '1963', 'C': '1972', 'D': '1990' },
        'ans': 'B',
        'exp': 'The FFS was established in 1963 as an integral part of the Federal Ministry of Internal Affairs (now Interior).'
    },
    {
        'id': 'F2',
        'subject': 'FIRE_FFS',
        'q': 'Who is the Chief Executive Officer of the Federal Fire Service?',
        'options': { 'A': 'Comptroller General', 'B': 'Director General', 'C': 'Controller General (CG)', 'D': 'The Head of Service' },
        'ans': 'C',
        'exp': 'The head of the FFS is the Controller General (CG).'
    },
    {
        'id': 'F3',
        'subject': 'FIRE_FFS',
        'q': 'What is the primary function of the Federal Fire Service?',
        'options': { 'A': 'Border security and immigration control', 'B': 'Fire prevention, mitigation, and rescue services', 'C': 'Correctional facility management', 'D': 'Pipeline protection' },
        'ans': 'B',
        'exp': 'The core function of the FFS is related to fire fighting, prevention, and rescue.'
    },
    {
        'id': 'F4',
        'subject': 'FIRE_FFS',
        'q': 'The Federal Fire Service falls under the supervision of which Federal Ministry?',
        'options': { 'A': 'Ministry of Power', 'B': 'Ministry of Defence', 'C': 'Ministry of Interior', 'D': 'Ministry of Aviation' },
        'ans': 'C',
        'exp': 'The FFS, like NIS and NSCDC, is supervised by the Federal Ministry of Interior.'
    },
    {
        'id': 'F5',
        'subject': 'FIRE_FFS',
        'q': 'What is the popular motto associated with the Federal Fire Service?',
        'options': { 'A': 'Saving Lives and Properties', 'B': 'Integrity and Border Security', 'C': 'Peace and Security', 'D': 'The Customer is King' },
        'ans': 'A',
        'exp': 'A widely used motto reflecting the FFS mandate is \'Saving Lives and Properties\'.'
    },
    {
        'id': 'F6',
        'subject': 'FIRE_FFS',
        'q': 'Which piece of legislation governs the establishment and operation of the FFS?',
        'options': { 'A': 'Police Act', 'B': 'Federal Fire Service Act (or similar Fire Service Law)', 'C': 'Customs Act', 'D': 'Immigration Act' },
        'ans': 'B',
        'exp': 'The FFS is governed by the Federal Fire Service Act (as amended).'
    },
    {
        'id': 'F7',
        'subject': 'FIRE_FFS',
        'q': 'The FFS uniform is primarily which colour, reflecting its emergency nature?',
        'options': { 'A': 'Green', 'B': 'Blue', 'C': 'Red', 'D': 'Black' },
        'ans': 'D',
        'exp': 'The operational uniforms of the FFS are typically black or navy blue, with reflective strips for safety.'
    },
    {
        'id': 'F8',
        'subject': 'FIRE_FFS',
        'q': 'What is the FFS\'s role in the event of building collapse?',
        'options': { 'A': 'Traffic control', 'B': 'Post-disaster audit only', 'C': 'Search and Rescue (SAR) operations', 'D': 'Issuance of building permits' },
        'ans': 'C',
        'exp': 'Rescue is a crucial mandate of the FFS, particularly in structural collapse incidents.'
    },
    {
        'id': 'F9',
        'subject': 'FIRE_FFS',
        'q': 'The most common class of fire involving ordinary combustible materials like wood and paper is:',
        'options': { 'A': 'Class A', 'B': 'Class B', 'C': 'Class C', 'D': 'Class D' },
        'ans': 'A',
        'exp': 'Class A fires involve solid materials of an organic nature.'
    },
    {
        'id': 'F10',
        'subject': 'FIRE_FFS',
        'q': 'Which type of equipment is used by the FFS to extinguish fires involving flammable liquids (e.g., petrol)?',
        'options': { 'A': 'Water hoses only', 'B': 'Foam and specialized chemical extinguishers', 'C': 'Sand buckets only', 'D': 'Oxygen tanks' },
        'ans': 'B',
        'exp': 'Fires involving flammable liquids require foam or specific chemical extinguishers (Class B fires).'
    },
    {
        'id': 'F11',
        'subject': 'FIRE_FFS',
        'q': 'What does the acronym \'FFS\' stand for?',
        'options': { 'A': 'Federal Forces Security', 'B': 'First Fire Safety', 'C': 'Federal Fire Service', 'D': 'Fast Fire Suppression' },
        'ans': 'C',
        'exp': 'FFS stands for Federal Fire Service.'
    },
    {
        'id': 'F12',
        'subject': 'FIRE_FFS',
        'q': 'What is the main component of dry chemical powder extinguishers?',
        'options': { 'A': 'Monoammonium phosphate', 'B': 'Sodium bicarbonate', 'C': 'Potassium chloride', 'D': 'Calcium carbonate' },
        'ans': 'A',
        'exp': 'Dry chemical powders commonly use monoammonium phosphate as the extinguishing agent.'
    },

    // NIGERIA SECURITY AND CIVIL DEFENCE CORPS (NSCDC) - For CIVIL_DEFENCE_NSCDC focus
    {
        'id': 'C1',
        'subject': 'CIVIL_DEFENCE_NSCDC',
        'q': 'The Nigeria Security and Civil Defence Corps (NSCDC) was established in what year as a volunteer organization?',
        'options': { 'A': '1945', 'B': '1967', 'C': '1990', 'D': '2003' },
        'ans': 'B',
        'exp': 'The NSCDC was first established in 1967 as a voluntary organization in Lagos State during the Nigerian Civil War.'
    },
    {
        'id': 'C2',
        'subject': 'CIVIL_DEFENCE_NSCDC',
        'q': 'Who is the head of the Nigeria Security and Civil Defence Corps?',
        'options': { 'A': 'Comptroller General', 'B': 'Commandant General (CG)', 'C': 'Inspector General', 'D': 'Controller General' },
        'ans': 'B',
        'exp': 'The head of the NSCDC is the Commandant General (CG).'
    },
    {
        'id': 'C3',
        'subject': 'CIVIL_DEFENCE_NSCDC',
        'q': 'What is the primary legislation that formally gave legal backing to the NSCDC and made it a federal para-military agency?',
        'options': { 'A': 'Police Act 1990', 'B': 'NSCDC Act 2003', 'C': 'Immigration Act 2015', 'D': 'Corrections Act 2019' },
        'ans': 'B',
        'exp': 'The NSCDC Act of 2003 established the Corps as a full-fledged federal agency.'
    },
    {
        'id': 'C4',
        'subject': 'CIVIL_DEFENCE_NSCDC',
        'q': 'The NSCDC is under the supervision of which Nigerian Federal Ministry?',
        'options': { 'A': 'Ministry of Justice', 'B': 'Ministry of Defence', 'C': 'Ministry of Interior', 'D': 'Ministry of Environment' },
        'ans': 'C',
        'exp': 'The NSCDC is supervised by the Federal Ministry of Interior.'
    },
    {
        'id': 'C5',
        'subject': 'CIVIL_DEFENCE_NSCDC',
        'q': 'Which of these is a key function of the NSCDC, especially regarding national assets?',
        'options': { 'A': 'Issuance of passports', 'B': 'Securing critical national infrastructure and assets (e.g., pipelines)', 'C': 'Managing federal prisons', 'D': 'Customs revenue collection' },
        'ans': 'B',
        'exp': 'Protection of critical national assets and infrastructure, especially oil pipelines, is a major statutory function.'
    },
    {
        'id': 'C6',
        'subject': 'CIVIL_DEFENCE_NSCDC',
        'q': 'What is the official motto of the Nigeria Security and Civil Defence Corps?',
        'options': { 'A': 'Integrity and Border Security', 'B': 'Defending the Nation with Valor', 'C': 'Defending the Nation and Disaster Management', 'D': 'Security and Justice' },
        'ans': 'C',
        'exp': 'The motto is \'Defending the Nation and Disaster Management\', reflecting its dual role.'
    },
    {
        'id': 'C7',
        'subject': 'CIVIL_DEFENCE_NSCDC',
        'q': 'Which NSCDC Unit is specifically tasked with monitoring and protecting oil and gas installations?',
        'options': { 'A': 'Anti-Vandalism Unit', 'B': 'Medical Unit', 'C': 'Public Relations Unit', 'D': 'Welfare Unit' },
        'ans': 'A',
        'exp': 'The Anti-Vandalism Unit is specifically dedicated to pipeline protection and combating oil theft.'
    },
    {
        'id': 'C8',
        'subject': 'CIVIL_DEFENCE_NSCDC',
        'q': 'The NSCDC is also primarily responsible for the registration, licensing, and supervision of:',
        'options': { 'A': 'Commercial bus drivers', 'B': 'Private Guard Companies (PGCs)', 'C': 'Federal Universities', 'D': 'Oil Prospecting Licenses' },
        'ans': 'B',
        'exp': 'The NSCDC has the legal mandate to license and regulate Private Guard Companies in Nigeria.'
    },
    {
        'id': 'C9',
        'subject': 'CIVIL_DEFENCE_NSCDC',
        'q': 'The NSCDC uniform is primarily which colour, giving it a distinctive appearance?',
        'options': { 'A': 'Red', 'B': 'Blue', 'C': 'Khaki/Ash-Grey', 'D': 'White' },
        'ans': 'C',
        'exp': 'The NSCDC uniform is distinctively Khaki/Ash-Grey or a light brown colour.'
    },
    {
        'id': 'C10',
        'subject': 'CIVIL_DEFENCE_NSCDC',
        'q': 'The NSCDC was first given a mandate for permanent security duties in which year?',
        'options': { 'A': '1967', 'B': '1988', 'C': '2003', 'D': '2010' },
        'ans': 'C',
        'exp': 'The NSCDC Act of 2003 formally transformed it from a voluntary to a statutory para-military organization.'
    },
    {
        'id': 'C11',
        'subject': 'CIVIL_DEFENCE_NSCDC',
        'q': 'What does the symbol of the torch in the NSCDC logo represent?',
        'options': { 'A': 'Agriculture', 'B': 'Light/Enlightenment and security awareness', 'C': 'Oil and gas', 'D': 'International trade' },
        'ans': 'B',
        'exp': 'The torch typically symbolizes enlightenment, knowledge, and guiding light.'
    },
    {
        'id': 'C12',
        'subject': 'CIVIL_DEFENCE_NSCDC',
        'q': 'The NSCDC\'s commitment to gender mainstreaming led to the creation of the:',
        'options': { 'A': 'Disaster Response Squad', 'B': 'Female Squad for security and protection of schools', 'C': 'Pipeline Protection Force', 'D': 'Music and Cultural Unit' },
        'ans': 'B',
        'exp': 'The Female Squad was established to enhance security, particularly in schools and vulnerable areas.'
    },

    // NIGERIAN CORRECTIONAL SERVICE (NCoS) - For CORRECTIONAL_NCS focus
    {
        'id': 'N1',
        'subject': 'CORRECTIONAL_NCS',
        'q': 'The Nigerian Correctional Service (NCoS) was formerly known as the:',
        'options': { 'A': 'Nigerian Immigration Service', 'B': 'Nigerian Prisons Service (NPS)', 'C': 'Nigerian Civil Defence Corps', 'D': 'Federal Fire Department' },
        'ans': 'B',
        'exp': 'The NCoS was officially known as the Nigerian Prisons Service before the 2019 Act.'
    },
    {
        'id': 'N2',
        'subject': 'CORRECTIONAL_NCS',
        'q': 'Who is the head of the Nigerian Correctional Service?',
        'options': { 'A': 'Commandant General', 'B': 'Comptroller General', 'C': 'Controller General of Corrections (CGC)', 'D': 'Inspector General' },
        'ans': 'C',
        'exp': 'The head of the NCoS is the Controller General of Corrections (CGC).'
    },
    {
        'id': 'N3',
        'subject': 'CORRECTIONAL_NCS',
        'q': 'What is the primary piece of legislation that established the NCoS and changed its name?',
        'options': { 'A': 'Criminal Code Act 1990', 'B': 'Prisons Act 1972', 'C': 'Nigerian Correctional Service Act 2019', 'D': 'Federal Penal Code' },
        'ans': 'C',
        'exp': 'The Nigerian Correctional Service Act 2019 officially changed the name and introduced a new mandate.'
    },
    {
        'id': 'N4',
        'subject': 'CORRECTIONAL_NCS',
        'q': 'The NCoS is under the supervision of which Nigerian Federal Ministry?',
        'options': { 'A': 'Ministry of Justice', 'B': 'Ministry of Interior', 'C': 'Ministry of Defence', 'D': 'Ministry of Health' },
        'ans': 'B',
        'exp': 'The NCoS is supervised by the Federal Ministry of Interior.'
    },
    {
        'id': 'N5',
        'subject': 'CORRECTIONAL_NCS',
        'q': 'What is the core focus of the NCoS mandate, distinguishing it from the former NPS?',
        'options': { 'A': 'Only punitive detention', 'B': 'Correctional services focused on rehabilitation and reintegration', 'C': 'Border security', 'D': 'Firefighting' },
        'ans': 'B',
        'exp': 'The 2019 Act shifted the focus from punishment (Prisons) to reform and rehabilitation (Correctional Service).'
    },
    {
        'id': 'N6',
        'subject': 'CORRECTIONAL_NCS',
        'q': 'The NCoS is divided into how many operational directorates at the National Headquarters level?',
        'options': { 'A': '2', 'B': '6-8 (depending on current structure)', 'C': '15', 'D': '37' },
        'ans': 'B',
        'exp': 'The NCoS, like other federal agencies, is structured into various operational directorates (e.g., Operations, Administration, Health, Inmate Training, etc.).'
    },
    {
        'id': 'N7',
        'subject': 'CORRECTIONAL_NCS',
        'q': 'What is the role of the Non-Custodial Service component of the NCoS?',
        'options': { 'A': 'Detaining high-profile offenders only', 'B': 'Managing community service, parole, and probation for minor offenders outside the custodial facility', 'C': 'Issuing travel documents', 'D': 'Operating state prisons' },
        'ans': 'B',
        'exp': 'Non-Custodial Service manages alternatives to incarceration as mandated by the 2019 Act.'
    },
    {
        'id': 'N8',
        'subject': 'CORRECTIONAL_NCS',
        'q': 'What is the highest rank in the NCoS after the Controller General of Corrections (CGC)?',
        'options': { 'A': 'Assistant Controller General of Corrections (ACGC)', 'B': 'Deputy Controller General of Corrections (DCGC)', 'C': 'Controller of Corrections (CC)', 'D': 'Warder Major' },
        'ans': 'B',
        'exp': 'The Deputy Controller General of Corrections (DCGC) is the second highest rank.'
    },
    {
        'id': 'N9',
        'subject': 'CORRECTIONAL_NCS',
        'q': 'Which NCoS rank is immediately below the Controller General of Corrections?',
        'options': { 'A': 'Assistant Controller General of Corrections (ACGC)', 'B': 'Deputy Controller General of Corrections (DCGC)', 'C': 'Controller of Corrections (CC)', 'D': 'Warder Major' },
        'ans': 'B',
        'exp': 'The Deputy Controller General of Corrections (DCGC) is the immediate deputy to the CGC.'
    },
    {
        'id': 'N10',
        'subject': 'CORRECTIONAL_NCS',
        'q': 'The NCoS encourages inmates to acquire vocational skills such as tailoring, carpentry, and welding primarily to:',
        'options': { 'A': 'Make money for the service', 'B': 'Equip them for self-reliance and reduce recidivism upon release', 'C': 'Keep them busy', 'D': 'Decorate the facility' },
        'ans': 'B',
        'exp': 'Skill acquisition is the foundation of rehabilitation and successful reintegration.'
    },
    {
        'id': 'N11',
        'subject': 'CORRECTIONAL_NCS',
        'q': 'The 2019 NCoS Act introduces the concept of which maximum term for Non-Custodial sentences?',
        'options': { 'A': '1 year', 'B': '10 years', 'C': '5 years', 'D': '3 months' },
        'ans': 'C',
        'exp': 'The Act provides for a non-custodial sentence (e.g., community service) not exceeding 5 years.'
    },
    {
        'id': 'N12',
        'subject': 'CORRECTIONAL_NCS',
        'q': 'What is the NCoS\'s role in the event of a prison break/jailbreak?',
        'options': { 'A': 'To ignore it as a local matter', 'B': 'To immediately mobilize for recapture and launch an internal investigation', 'C': 'To declare a national holiday', 'D': 'To blame another agency' },
        'ans': 'B',
        'exp': 'Swift recapture and internal investigation are mandatory security protocols after a jailbreak.'
    }
];

// Expose data to window for easier debugging in local browsers (module scope isn't global)
try {
    if (typeof window !== 'undefined' && !window.fullQuestionsData) {
        window.fullQuestionsData = fullQuestionsData;
    }
} catch (e) {
    // silent - debugging helper should not break the app
}


// --- FIREBASE INITIALIZATION AND AUTHENTICATION ---

// Function to set up Firebase and handle initial authentication, or bypass for local use.
const setupFirebase = async () => {
    // Check if Firebase configuration is available (i.e., not running in local environment)
    const isLocalRun = !firebaseConfig || typeof initializeApp === 'undefined';
    const authUidElement = document.getElementById('auth-uid');
    
    if (isLocalRun) {
        console.warn("Running in local (standalone) mode. Firestore persistence disabled.");
        userId = 'local-user-' + Math.random().toString(36).substring(2, 8); 
        authUidElement.textContent = userId + ' (LOCAL)';
        startButton.disabled = false;
        loadingSpinner.classList.add('hidden');
        isFirebaseActive = false;
        return; 
    }
    
    // --- Firebase Initialization (Only runs if config is present) ---
    isFirebaseActive = true;
    try {
        setLogLevel('debug');
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                userId = user.uid; // Store the authenticated user ID.
                authUidElement.textContent = userId;
                await getOrCreateUserProfile(userId);
            } else {
                // Sign in using the provided token or anonymously if token is absent.
                try {
                    if (initialAuthToken) {
                        await signInWithCustomToken(auth, initialAuthToken);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (error) {
                    console.error("Firebase Sign-in failed:", error);
                    document.getElementById('error-message').innerText = `Auth Error: ${error.message}`;
                    document.getElementById('error-message').classList.remove('hidden');
                }
            }
            startButton.disabled = false; // Enable the start button once auth is attempted.
            loadingSpinner.classList.add('hidden'); 
        });
    } catch (error) {
        console.error("Firebase Initialization failed:", error);
        document.getElementById('error-message').innerText = `Init Error: ${error.message}`;
        document.getElementById('error-message').classList.remove('hidden');
        loadingSpinner.classList.add('hidden');
        isFirebaseActive = false;
    }
};

// Helper to get user profile document path (conditional on Firebase being active)
const getUserProfileDocRef = (uid) => {
    if (!isFirebaseActive) return null;
    return doc(db, `artifacts/${appId}/users/${uid}/cbt_profiles/profile`);
};

// Helper to get exam results collection path (conditional on Firebase being active)
const getExamResultsCollectionRef = (uid) => {
    if (!isFirebaseActive) return null;
    return collection(db, `artifacts/${appId}/users/${uid}/cbt_results`);
};

// Function to fetch the user profile or create one (conditional on Firebase being active)
const getOrCreateUserProfile = async (uid) => {
    if (!isFirebaseActive) return;
    const profileRef = getUserProfileDocRef(uid);
    const docSnap = await getDoc(profileRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.name) {
            nameInput.value = data.name;
            candidateName = data.name;
        }
    } else {
        await setDoc(profileRef, { uid: uid, createdAt: serverTimestamp(), examsTaken: 0 });
    }
};

// --- EXAM CORE LOGIC ---

// Utility function to shuffle an array (Fisher-Yates)
const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

// Function to initialize the exam data with the 4-subject rotation logic.
const initializeExam = () => {
    examQuestions = []; 
    
    // Determine the subject to pull Departmental questions from.
    // If GENERAL_ALL is selected, the extra questions are pulled from the main GENERAL pool.
    const departmentalSubject = selectedDepartment === 'GENERAL_ALL' ? 'GENERAL' : selectedDepartment;
    
    // 1. Compile questions from FIXED subjects (MATHS, ENGLISH, GENERAL)
    FIXED_SUBJECTS.forEach(subject => {
        // If GENERAL is the chosen departmental subject, we pull all 12 from the department pool instead.
        if (subject === 'GENERAL' && departmentalSubject !== 'GENERAL') {
             // Only pull 12 if General is NOT the focus
            let subjectPool = fullQuestionsData.filter(q => q.subject === subject);
            subjectPool = shuffleArray(subjectPool);
            const count = QUESTIONS_PER_SUBJECT_MAP[subject];
            const selectedQuestions = subjectPool.slice(0, count);
            examQuestions.push(...selectedQuestions);
        } else if (subject !== 'GENERAL') {
            let subjectPool = fullQuestionsData.filter(q => q.subject === subject);
            subjectPool = shuffleArray(subjectPool);
            const count = QUESTIONS_PER_SUBJECT_MAP[subject];
            const selectedQuestions = subjectPool.slice(0, count);
            examQuestions.push(...selectedQuestions);
        }
    });
    
    // 2. Compile questions from the DEPARTMENTAL subject
    // Pull the required number (12) from the chosen departmental pool.
    const departmentalPool = fullQuestionsData.filter(q => q.subject === departmentalSubject);
    const shuffledDepartmentalPool = shuffleArray(departmentalPool);
    const departmentalCount = QUESTIONS_PER_SUBJECT_MAP.DEPARTMENTAL;
    const selectedDepartmentalQuestions = shuffledDepartmentalPool.slice(0, departmentalCount);
    examQuestions.push(...selectedDepartmentalQuestions);
    
    // Final check to ensure we hit 50 questions
    if (examQuestions.length !== TOTAL_QUESTIONS_COUNT) {
        // This is a safety measure if the data selection logic is flawed.
        console.error(`Error in question selection. Expected ${TOTAL_QUESTIONS_COUNT}, got ${examQuestions.length}.`);
    }

    // Final shuffle of the entire exam list to mix the subjects up for the test taker
    examQuestions = shuffleArray(examQuestions);
    
    // Reset state for a new exam
    currentQuestionIndex = 0;
    userAnswers = {};
    timeRemaining = MAX_TIME_SECONDS;
    
    // Start the exam flow
    showScreen('exam-screen');
    startTimer();
    renderQuestion();
    renderNavigationGrid();
};

// Function to update the display of the current question.
const renderQuestion = () => {
    const question = examQuestions[currentQuestionIndex];
    if (!question) return;

    // Display subject name clearly
    const subjectDisplay = question.subject.replace('_', ' ').replace('NIS', '(NIS)').replace('NSCDC', '(NSCDC)').replace('NCS', '(NCS)').replace('FFS', '(FFS)');
    document.getElementById('question-text').innerHTML = `Q${currentQuestionIndex + 1}. <span class="text-blue-700 font-bold">(${subjectDisplay})</span> ${question.q}`;
    
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = ''; 

    // Generate option buttons
    Object.keys(question.options).forEach(key => {
        const optionText = question.options[key];
        const isSelected = userAnswers[question.id] === key;

        const optionButton = document.createElement('button');
        optionButton.className = `w-full text-left p-3 border border-gray-300 rounded-lg transition duration-150 hover:bg-gray-100 ${isSelected ? 'option-selected' : 'bg-white text-gray-800'}`;
        optionButton.innerHTML = `<span class="font-bold mr-2">${key}.</span> ${optionText}`;
        optionButton.dataset.option = key;
        optionButton.dataset.questionId = question.id;
        
        optionButton.addEventListener('click', handleOptionClick);
        optionsContainer.appendChild(optionButton);
    });

    // Update navigation buttons status
    document.getElementById('prev-button').disabled = currentQuestionIndex === 0;
    document.getElementById('next-button').disabled = currentQuestionIndex === examQuestions.length - 1;

    updateNavGridHighlight();
};

// Function to handle the selection of an answer option.
const handleOptionClick = (event) => {
    const selectedButton = event.currentTarget;
    const optionKey = selectedButton.dataset.option;
    const questionId = selectedButton.dataset.questionId;
    const allOptionButtons = selectedButton.parentNode.querySelectorAll('button');

    // 1. Reset visual state of all options 
    allOptionButtons.forEach(btn => btn.classList.remove('option-selected'));

    // 2. Update userAnswers state and apply visual selection
    userAnswers[questionId] = optionKey;
    selectedButton.classList.add('option-selected');

    // 3. Update the navigation grid button to 'answered' (green)
    const navButton = document.querySelector(`.nav-q[data-index="${currentQuestionIndex}"]`);
    if (navButton) {
        navButton.classList.remove('bg-gray-300', 'bg-blue-500', 'bg-yellow-500');
        navButton.classList.add('bg-green-500', 'text-white'); 
    }
};

// Function to handle moving between questions.
const navigateQuestion = (direction) => {
    const newIndex = currentQuestionIndex + direction;
    if (newIndex >= 0 && newIndex < examQuestions.length) {
        currentQuestionIndex = newIndex;
        renderQuestion();
    }
};

// Function to create the grid of numbered buttons for question navigation.
const renderNavigationGrid = () => {
    const grid = document.getElementById('navigation-grid');
    grid.innerHTML = '';
    
    examQuestions.forEach((q, index) => {
        const navButton = document.createElement('button');
        navButton.className = `nav-q w-8 h-8 text-xs font-semibold rounded transition duration-100 bg-gray-300 hover:bg-gray-400 text-gray-800`;
        navButton.textContent = index + 1;
        navButton.dataset.index = index;
        
        navButton.addEventListener('click', () => {
            currentQuestionIndex = index;
            renderQuestion();
        });

        grid.appendChild(navButton);
    });
};

// Function to highlight the currently viewed question in the navigation grid.
const updateNavGridHighlight = () => {
    document.querySelectorAll('.nav-q').forEach(btn => {
        btn.classList.remove('border-2', 'border-red-500'); 
        
        // Restore answered color (green) or unmarked color (gray)
        const question = examQuestions[parseInt(btn.dataset.index)];
        const isAnswered = userAnswers[question.id];

        if (isAnswered) {
             btn.classList.remove('bg-gray-300', 'bg-blue-500', 'text-gray-800');
             btn.classList.add('bg-green-500', 'text-white');
        } else {
             btn.classList.remove('bg-green-500', 'bg-blue-500', 'text-white');
             btn.classList.add('bg-gray-300', 'text-gray-800');
        }
    });
    
    // Highlight the active question with a red border
    const currentNavButton = document.querySelector(`.nav-q[data-index="${currentQuestionIndex}"]`);
    if (currentNavButton) {
        currentNavButton.classList.add('border-2', 'border-red-500');
    }
};

// --- TIMER LOGIC AND UTILS ---

// Function to format time (seconds) into MM:SS string.
const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Function to start the exam countdown timer.
const startTimer = () => {
    clearInterval(timerInterval); 
    
    const timerElement = document.getElementById('timer');
    timerElement.textContent = formatTime(timeRemaining);
    
    timerInterval = setInterval(() => {
        timeRemaining--;
        timerElement.textContent = formatTime(timeRemaining);

        // Visual warning for the last minute
        if (timeRemaining <= 60 && timeRemaining > 0) {
            timerElement.classList.remove('text-red-600');
            timerElement.classList.add('text-red-800', 'animate-pulse'); 
        } else if (timeRemaining > 60) {
            timerElement.classList.remove('text-red-800', 'animate-pulse');
            timerElement.classList.add('text-red-600');
        }
        
        // Auto-submit when time runs out
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            timeRemaining = 0;
            handleSubmitExam(true); // isTimeout = true
        }
    }, 1000);
};

// --- SUBMISSION AND SCORING ---

// Main function to calculate score, save results (if online), and show the review screen.
const handleSubmitExam = async (isTimeout = false) => {
    clearInterval(timerInterval); 
    loadingSpinner.classList.remove('hidden'); 

    let score = 0;
    const totalTimeSpent = MAX_TIME_SECONDS - timeRemaining;
    const results = [];

    // 1. Calculate Score and prepare results
    examQuestions.forEach(q => {
        const userAnswer = userAnswers[q.id];
        const isCorrect = userAnswer === q.ans;
        if (isCorrect) {
            score++;
        }
        results.push({
            id: q.id,
            q: q.q,
            options: q.options,
            correctAnswer: q.ans,
            userAnswer: userAnswer || 'N/A', 
            isCorrect: isCorrect,
            explanation: q.exp, 
            subject: q.subject
        });
    });
    
    // 2. Prepare and save result document to Firestore (Only if Firebase is active)
    if (isFirebaseActive) {
        const resultDoc = {
            candidateId: userId,
            candidateName: candidateName,
            department: selectedDepartment,
            score: score,
            totalQuestions: TOTAL_QUESTIONS_COUNT,
            percentage: (score / TOTAL_QUESTIONS_COUNT) * 100,
            timeSpentSeconds: totalTimeSpent,
            submissionTime: serverTimestamp(),
            questions: results, 
            isTimeout: isTimeout
        };

        try {
            const resultsRef = getExamResultsCollectionRef(userId);
            await setDoc(doc(resultsRef), resultDoc); 
            
            // Update user profile metadata
            const profileRef = getUserProfileDocRef(userId);
            const profileSnap = await getDoc(profileRef);
            const examsTaken = profileSnap.exists() ? (profileSnap.data().examsTaken || 0) : 0;
            await updateDoc(profileRef, {
                examsTaken: examsTaken + 1,
                lastExam: serverTimestamp()
            });

        } catch (error) {
            console.error("Error saving results to Firestore:", error);
        }
    } else {
        console.log("Local Mode: Results calculated but not saved to cloud.");
    }
    
    loadingSpinner.classList.add('hidden'); 

    // 3. Display Results Screen
    displayResults(score, totalTimeSpent, results);
};

// Function to render the final score and the detailed review list.
const displayResults = (score, totalTimeSpent, results) => {
    // Update score card elements
    document.getElementById('candidate-name-results').textContent = candidateName;
    document.getElementById('final-score').textContent = `${score}/${TOTAL_QUESTIONS_COUNT}`;
    document.getElementById('time-spent').textContent = formatTime(totalTimeSpent);

    const reviewList = document.getElementById('review-list');
    reviewList.innerHTML = ''; 

    // Iterate through results to build the review cards
    results.forEach((q, index) => {
        const reviewCard = document.createElement('div');
        reviewCard.className = `p-5 rounded-xl shadow-lg border-l-4 ${q.isCorrect ? 'border-green-600 bg-green-50' : 'border-red-600 bg-red-50'}`;
        
        let optionsHtml = '';
        Object.keys(q.options).forEach(key => {
            const optionText = q.options[key];
            let optionClass = 'w-full text-left p-2 border border-gray-300 rounded transition duration-150 text-gray-800 bg-white';

            // Apply coloring logic for review
            if (key === q.correctAnswer) {
                optionClass = 'option-correct'; 
            } else if (key === q.userAnswer && key !== q.correctAnswer) {
                optionClass = 'option-incorrect'; 
            } else if (key === q.userAnswer && key === q.correctAnswer) {
                optionClass = 'option-correct'; 
            }

            optionsHtml += `<button class="${optionClass} my-1 text-sm"><span class="font-bold mr-2">${key}.</span> ${optionText}</button>`;
        });

        // Build the card content
        const subjectDisplay = q.subject.replace('_', ' ').replace('NIS', '(NIS)').replace('NSCDC', '(NSCDC)').replace('NCS', '(NCS)').replace('FFS', '(FFS)');
        reviewCard.innerHTML = `
            <p class="text-xs font-semibold text-gray-500 mb-1">Subject: ${subjectDisplay}</p>
            <p class="text-lg font-bold mb-2 text-gray-800">Q${index + 1}. ${q.q}</p>
            <div class="space-y-1">${optionsHtml}</div>
            <div class="mt-4 p-3 border-t pt-3 border-gray-200">
                <p class="font-semibold ${q.isCorrect ? 'text-green-600' : 'text-red-600'}">
                    Your Answer: <span class="uppercase">${q.userAnswer}</span> | Status: ${q.isCorrect ? 'Correct' : 'Incorrect'}
                </p>
                <p class="mt-2 text-sm text-gray-700">
                    <span class="font-bold text-blue-600">Explanation:</span> ${q.explanation}
                </p>
            </div>
        `;
        reviewList.appendChild(reviewCard);
    });

    showScreen('results-screen');
};

// --- UI/SCREEN MANAGEMENT ---

// Function to switch between main application screens.
const showScreen = (screenId) => {
    // Array of all screens
    [startScreen, lobbyScreen, examScreen, resultsScreen].forEach(screen => screen.classList.add('hidden'));

    // Display the requested screen
    document.getElementById(screenId).classList.remove('hidden');
};

// --- EVENT LISTENERS ---

// 1. Start Screen Listeners
startButton.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (name) {
        candidateName = name;
        selectedDepartment = departmentSelect.value;
        
        // Save/Update name in the user profile (conditional on Firebase)
        if (isFirebaseActive) {
            const profileRef = getUserProfileDocRef(userId);
            setDoc(profileRef, { name: candidateName, lastLogin: serverTimestamp() }, { merge: true }).catch(console.error);
        }

        // Update lobby screen details
        const subjectDisplay = selectedDepartment.replace('_', ' ').replace('NIS', '(NIS)').replace('NSCDC', '(NSCDC)').replace('NCS', '(NCS)').replace('FFS', '(FFS)');
        document.getElementById('candidate-name-lobby').textContent = candidateName;
        document.getElementById('department-lobby').textContent = subjectDisplay.toUpperCase();
        document.getElementById('exam-title').textContent = `CBT EXAM: ${subjectDisplay.toUpperCase()} FOCUS (${TOTAL_QUESTIONS_COUNT} Qs)`;

        showScreen('lobby-screen'); // Move to the lobby
    } else {
        document.getElementById('error-message').innerText = "Please enter your name/ID to proceed.";
        document.getElementById('error-message').classList.remove('hidden');
    }
});

// Enable start button only if a name is entered
nameInput.addEventListener('input', () => {
    startButton.disabled = nameInput.value.trim() === '';
    document.getElementById('error-message').classList.add('hidden');
});

// 2. Lobby Screen Listener
document.getElementById('begin-exam-button').addEventListener('click', () => {
    initializeExam(); // Start the actual exam logic
});

// 3. Exam Screen Listeners
document.getElementById('prev-button').addEventListener('click', () => navigateQuestion(-1));
document.getElementById('next-button').addEventListener('click', () => navigateQuestion(1));

// Submit Button -> Show Confirmation Modal
document.getElementById('submit-exam-button').addEventListener('click', () => {
    const answeredCount = Object.keys(userAnswers).length;
    document.getElementById('modal-text').textContent = `You have answered ${answeredCount} out of ${TOTAL_QUESTIONS_COUNT} questions. Are you sure you want to submit now?`;
    confirmationModal.classList.remove('hidden');
    confirmationModal.classList.add('flex');
});

// 4. Modal Listeners
document.getElementById('modal-confirm').addEventListener('click', () => {
    confirmationModal.classList.add('hidden');
    confirmationModal.classList.remove('flex');
    handleSubmitExam(false); 
});
document.getElementById('modal-cancel').addEventListener('click', () => {
    confirmationModal.classList.add('hidden');
    confirmationModal.classList.remove('flex');
});

// 5. Results Screen Listener
document.getElementById('restart-button').addEventListener('click', () => {
    showScreen('start-screen'); 
});

// --- INITIAL APP STARTUP ---
// Start the Firebase setup when the script is loaded. Use a robust startup wrapper
// so that local runs are not blocked by errors in async setup (prevents overlay from
// permanently covering the UI and ensures the start button becomes clickable).
window.onload = async () => {
    try {
        loadingSpinner.classList.remove('hidden');
        await setupFirebase();
    } catch (err) {
        console.error('Startup/setupFirebase error:', err);
        // Show a user-friendly message if possible
        const errEl = document.getElementById('error-message');
        if (errEl) {
            errEl.textContent = 'An initialization error occurred; running in local fallback mode.';
            errEl.classList.remove('hidden');
        }
    } finally {
        // Always hide the loading spinner and ensure the start button is enabled for local testing
        try {
            loadingSpinner.classList.add('hidden');
            if (startButton) startButton.disabled = false;
            // Debug helper: ensure the start button is on top and log clicks for troubleshooting
            try {
                const sb = document.getElementById('start-button');
                const ni = document.getElementById('name-input');
                if (sb) {
                    sb.style.zIndex = '9999';
                    sb.style.pointerEvents = 'auto';
                    sb.addEventListener('click', (ev) => {
                        console.log('DEBUG: start-button clicked', { disabled: sb.disabled, nameValue: ni ? ni.value : null });
                    });
                }
            } catch (dbgErr) { console.warn('Debug helper failed', dbgErr); }
        } catch (ignore) {}
    }
};
