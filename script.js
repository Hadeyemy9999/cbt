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
const confirmStartButton = document.getElementById('confirm-start-button');

// --- QUESTION DATA (New 4-Subject Structure) ---
const fullQuestionsData = [
    // --- MATHEMATICS (15 Questions Pool) ---
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
        "ans": "C",
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
        "ans": "A",
        "exp": "Multiply numerators and denominators: $2 \\times 3 = 6$, $3 \\times 5 = 15$."
    },
    {
        "id": "M14",
        "subject": "MATHS",
        "q": "Divide: $\\frac{4}{5} \u00f7 \\frac{2}{3}$",
        "options": {
            "A": "$\\frac{6}{5}$",
            "B": "$\\frac{8}{15}$",
            "C": "$\\frac{5}{6}$",
            "D": "$\\frac{4}{5}$"
        },
        "ans": "A",
        "exp": "Invert divisor and multiply: $\\frac{4}{5} \\times \\frac{3}{2} = \\frac{12}{10} = \\frac{6}{5}$."
    },
    {
        "id": "M15",
        "subject": "MATHS",
        "q": "Simplify: $\\frac{9}{12}$",
        "options": {
            "A": "$\\frac{3}{4}$",
            "B": "$\\frac{4}{5}$",
            "C": "$\\frac{9}{10}$",
            "D": "$\\frac{2}{3}$"
        },
        "ans": "A",
        "exp": "Divide top and bottom by 3: $\\frac{9}{12} = \\frac{3}{4}$."
    },
    {
        "id": "M16",
        "subject": "MATHS",
        "q": "Find the area of a rectangle with length 10 cm and width 5 cm.",
        "options": {
            "A": "$15\\text{ cm}^2$",
            "B": "$25\\text{ cm}^2$",
            "C": "$50\\text{ cm}^2$",
            "D": "$100\\text{ cm}^2$"
        },
        "ans": "C",
        "exp": "Area = length \u00d7 width = $10 \\times 5 = 50\\text{ cm}^2$."
    },
    {
        "id": "M17",
        "subject": "MATHS",
        "q": "Find the circumference of a circle with radius 7 cm. ($\\pi = 22/7$)",
        "options": {
            "A": "$22\\text{ cm}$",
            "B": "$44\\text{ cm}$",
            "C": "$33\\text{ cm}$",
            "D": "$49\\text{ cm}$"
        },
        "ans": "B",
        "exp": "Circumference = $2\\pi r = 2 \\times \\frac{22}{7} \\times 7 = 44$ cm."
    },
    {
        "id": "M18",
        "subject": "MATHS",
        "q": "Find the area of a triangle with base 8 cm and height 5 cm.",
        "options": {
            "A": "$40\\text{ cm}^2$",
            "B": "$20\\text{ cm}^2$",
            "C": "$25\\text{ cm}^2$",
            "D": "$15\\text{ cm}^2$"
        },
        "ans": "B",
        "exp": "Area = $\\frac{1}{2} \\times 8 \\times 5 = 20\\text{ cm}^2$."
    },
    {
        "id": "M19",
        "subject": "MATHS",
        "q": "A cube has a side length of 4 cm. Find its volume.",
        "options": {
            "A": "$64\\text{ cm}^3$",
            "B": "$16\\text{ cm}^3$",
            "C": "$32\\text{ cm}^3$",
            "D": "$48\\text{ cm}^3$"
        },
        "ans": "A",
        "exp": "Volume = side\u00b3 = $4^3 = 64\\text{ cm}^3$."
    },
    {
        "id": "M20",
        "subject": "MATHS",
        "q": "Find the perimeter of a square with side 6 cm.",
        "options": {
            "A": "$12\\text{ cm}$",
            "B": "$24\\text{ cm}$",
            "C": "$18\\text{ cm}$",
            "D": "$36\\text{ cm}$"
        },
        "ans": "B",
        "exp": "Perimeter = 4 \u00d7 side = $4 \\times 6 = 24\\text{ cm}$."
    },
    {
        "id": "M21",
        "subject": "MATHS",
        "q": "Simplify the ratio 12:8.",
        "options": {
            "A": "3:2",
            "B": "2:3",
            "C": "4:3",
            "D": "6:5"
        },
        "ans": "A",
        "exp": "Divide both terms by 4: 12 \u00f7 4 = 3, 8 \u00f7 4 = 2 \u2192 3:2."
    },
    {
        "id": "M22",
        "subject": "MATHS",
        "q": "Divide \u20a6600 in the ratio 2:3.",
        "options": {
            "A": "\u20a6200 and \u20a6400",
            "B": "\u20a6240 and \u20a6360",
            "C": "\u20a6250 and \u20a6350",
            "D": "\u20a6300 and \u20a6300"
        },
        "ans": "B",
        "exp": "Sum = 5 parts; \u20a6600 \u00f7 5 = \u20a6120 per part; \u20a6240 and \u20a6360 respectively."
    },
    {
        "id": "M23",
        "subject": "MATHS",
        "q": "If a map scale is 1:50,000, what distance does 2 cm represent?",
        "options": {
            "A": "1 km",
            "B": "0.5 km",
            "C": "2 km",
            "D": "10 km"
        },
        "ans": "A",
        "exp": "2 cm \u00d7 50,000 = 100,000 cm = 1 km."
    },
    {
        "id": "M24",
        "subject": "MATHS",
        "q": "Express 20 minutes as a fraction of an hour.",
        "options": {
            "A": "1/2",
            "B": "1/3",
            "C": "2/3",
            "D": "1/4"
        },
        "ans": "B",
        "exp": "20 min \u00f7 60 min = 1/3 of an hour."
    },
    {
        "id": "M25",
        "subject": "MATHS",
        "q": "The ratio of boys to girls in a class is 3:2. If there are 15 boys, how many girls?",
        "options": {
            "A": "5",
            "B": "8",
            "C": "10",
            "D": "12"
        },
        "ans": "C",
        "exp": "Each part = 15 \u00f7 3 = 5, girls = 2 \u00d7 5 = 10."
    },
    {
        "id": "M26",
        "subject": "MATHS",
        "q": "A coin is tossed once. Find the probability of getting a head.",
        "options": {
            "A": "$\\frac{1}{2}$",
            "B": "$\\frac{1}{3}$",
            "C": "$1$",
            "D": "$0$"
        },
        "ans": "A",
        "exp": "Two possible outcomes, 1 favorable \u2192 $1/2$."
    },
    {
        "id": "M27",
        "subject": "MATHS",
        "q": "Find the probability of getting an even number on a fair die.",
        "options": {
            "A": "$\\frac{1}{2}$",
            "B": "$\\frac{1}{3}$",
            "C": "$\\frac{2}{3}$",
            "D": "$\\frac{1}{6}$"
        },
        "ans": "A",
        "exp": "Even outcomes = 3 (2,4,6); total 6; $3/6 = 1/2$."
    },
    {
        "id": "M28",
        "subject": "MATHS",
        "q": "A bag has 3 red and 2 blue balls. Find P(blue).",
        "options": {
            "A": "$\\frac{1}{2}$",
            "B": "$\\frac{2}{5}$",
            "C": "$\\frac{3}{5}$",
            "D": "$\\frac{1}{3}$"
        },
        "ans": "B",
        "exp": "Total = 5, blue = 2, so P(blue) = 2/5."
    },
    {
        "id": "M29",
        "subject": "MATHS",
        "q": "Two coins are tossed. Find P(getting two heads).",
        "options": {
            "A": "$\\frac{1}{4}$",
            "B": "$\\frac{1}{3}$",
            "C": "$\\frac{1}{2}$",
            "D": "$\\frac{3}{4}$"
        },
        "ans": "A",
        "exp": "Outcomes = 4, favorable = 1 (HH), so 1/4."
    },
    {
        "id": "M30",
        "subject": "MATHS",
        "q": "A number is chosen from 1\u201310. Find P(odd).",
        "options": {
            "A": "$\\frac{1}{2}$",
            "B": "$\\frac{3}{5}$",
            "C": "$\\frac{2}{5}$",
            "D": "$\\frac{1}{3}$"
        },
        "ans": "B",
        "exp": "Odd numbers = 5, total = 10 \u2192 5/10 = 1/2."
    },
    {
        "id": "M31",
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
        "id": "M32",
        "subject": "MATHS",
        "q": "Solve for $x$: $2x + 5 = 11$",
        "options": {
            "A": "$x = 2$",
            "B": "$x = 3$",
            "C": "$x = 4$",
            "D": "$x = 5$"
        },
        "ans": "C",
        "exp": "Subtract 5 from both sides: $2x = 6$, divide by 2: $x = 3$."
    },
    {
        "id": "M33",
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
        "id": "M34",
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
        "id": "M35",
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
        "id": "M36",
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
        "id": "M37",
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
        "id": "M38",
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
        "id": "M39",
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
        "id": "M40",
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
        "id": "M41",
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
        "id": "M42",
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
        "id": "M43",
        "subject": "MATHS",
        "q": "Multiply: $\\frac{2}{3} \\times \\frac{3}{5}$",
        "options": {
            "A": "$\\frac{6}{15}$",
            "B": "$\\frac{2}{5}$",
            "C": "$\\frac{3}{8}$",
            "D": "$\\frac{1}{5}$"
        },
        "ans": "A",
        "exp": "Multiply numerators and denominators: $2 \\times 3 = 6$, $3 \\times 5 = 15$."
    },
    {
        "id": "M44",
        "subject": "MATHS",
        "q": "Divide: $\\frac{4}{5} \u00f7 \\frac{2}{3}$",
        "options": {
            "A": "$\\frac{6}{5}$",
            "B": "$\\frac{8}{15}$",
            "C": "$\\frac{5}{6}$",
            "D": "$\\frac{4}{5}$"
        },
        "ans": "A",
        "exp": "Invert divisor and multiply: $\\frac{4}{5} \\times \\frac{3}{2} = \\frac{12}{10} = \\frac{6}{5}$."
    },
    {
        "id": "M45",
        "subject": "MATHS",
        "q": "Simplify: $\\frac{9}{12}$",
        "options": {
            "A": "$\\frac{3}{4}$",
            "B": "$\\frac{4}{5}$",
            "C": "$\\frac{9}{10}$",
            "D": "$\\frac{2}{3}$"
        },
        "ans": "A",
        "exp": "Divide top and bottom by 3: $\\frac{9}{12} = \\frac{3}{4}$."
    },
    {
        "id": "M46",
        "subject": "MATHS",
        "q": "Find the area of a rectangle with length 10 cm and width 5 cm.",
        "options": {
            "A": "$15\\text{ cm}^2$",
            "B": "$25\\text{ cm}^2$",
            "C": "$50\\text{ cm}^2$",
            "D": "$100\\text{ cm}^2$"
        },
        "ans": "C",
        "exp": "Area = length \u00d7 width = $10 \\times 5 = 50\\text{ cm}^2$."
    },
    {
        "id": "M47",
        "subject": "MATHS",
        "q": "Find the circumference of a circle with radius 7 cm. ($\\pi = 22/7$)",
        "options": {
            "A": "$22\\text{ cm}$",
            "B": "$44\\text{ cm}$",
            "C": "$33\\text{ cm}$",
            "D": "$49\\text{ cm}$"
        },
        "ans": "B",
        "exp": "Circumference = $2\\pi r = 2 \\times \\frac{22}{7} \\times 7 = 44$ cm."
    },
    {
        "id": "M48",
        "subject": "MATHS",
        "q": "Find the area of a triangle with base 8 cm and height 5 cm.",
        "options": {
            "A": "$40\\text{ cm}^2$",
            "B": "$20\\text{ cm}^2$",
            "C": "$25\\text{ cm}^2$",
            "D": "$15\\text{ cm}^2$"
        },
        "ans": "B",
        "exp": "Area = $\\frac{1}{2} \\times 8 \\times 5 = 20\\text{ cm}^2$."
    },
    {
        "id": "M49",
        "subject": "MATHS",
        "q": "A cube has a side length of 4 cm. Find its volume.",
        "options": {
            "A": "$64\\text{ cm}^3$",
            "B": "$16\\text{ cm}^3$",
            "C": "$32\\text{ cm}^3$",
            "D": "$48\\text{ cm}^3$"
        },
        "ans": "A",
        "exp": "Volume = side\u00b3 = $4^3 = 64\\text{ cm}^3$."
    },
    {
        "id": "M50",
        "subject": "MATHS",
        "q": "Find the perimeter of a square with side 6 cm.",
        "options": {
            "A": "$12\\text{ cm}$",
            "B": "$24\\text{ cm}$",
            "C": "$18\\text{ cm}$",
            "D": "$36\\text{ cm}$"
        },
        "ans": "B",
        "exp": "Perimeter = 4 \u00d7 side = $4 \\times 6 = 24\\text{ cm}$."
    },
    {
        "id": "M51",
        "subject": "MATHS",
        "q": "Simplify the ratio 12:8.",
        "options": {
            "A": "3:2",
            "B": "2:3",
            "C": "4:3",
            "D": "6:5"
        },
        "ans": "A",
        "exp": "Divide both terms by 4: 12 \u00f7 4 = 3, 8 \u00f7 4 = 2 \u2192 3:2."
    },
    {
        "id": "M52",
        "subject": "MATHS",
        "q": "Divide \u20a6600 in the ratio 2:3.",
        "options": {
            "A": "\u20a6200 and \u20a6400",
            "B": "\u20a6240 and \u20a6360",
            "C": "\u20a6250 and \u20a6350",
            "D": "\u20a6300 and \u20a6300"
        },
        "ans": "B",
        "exp": "Sum = 5 parts; \u20a6600 \u00f7 5 = \u20a6120 per part; \u20a6240 and \u20a6360 respectively."
    },
    {
        "id": "M53",
        "subject": "MATHS",
        "q": "If a map scale is 1:50,000, what distance does 2 cm represent?",
        "options": {
            "A": "1 km",
            "B": "0.5 km",
            "C": "2 km",
            "D": "10 km"
        },
        "ans": "A",
        "exp": "2 cm \u00d7 50,000 = 100,000 cm = 1 km."
    },
    {
        "id": "M54",
        "subject": "MATHS",
        "q": "Express 20 minutes as a fraction of an hour.",
        "options": {
            "A": "1/2",
            "B": "1/3",
            "C": "2/3",
            "D": "1/4"
        },
        "ans": "B",
        "exp": "20 min \u00f7 60 min = 1/3 of an hour."
    },
    {
        "id": "M55",
        "subject": "MATHS",
        "q": "The ratio of boys to girls in a class is 3:2. If there are 15 boys, how many girls?",
        "options": {
            "A": "5",
            "B": "8",
            "C": "10",
            "D": "12"
        },
        "ans": "C",
        "exp": "Each part = 15 \u00f7 3 = 5, girls = 2 \u00d7 5 = 10."
    },
    {
        "id": "M56",
        "subject": "MATHS",
        "q": "A coin is tossed once. Find the probability of getting a head.",
        "options": {
            "A": "$\\frac{1}{2}$",
            "B": "$\\frac{1}{3}$",
            "C": "$1$",
            "D": "$0$"
        },
        "ans": "A",
        "exp": "Two possible outcomes, 1 favorable \u2192 $1/2$."
    },
    {
        "id": "M57",
        "subject": "MATHS",
        "q": "Find the probability of getting an even number on a fair die.",
        "options": {
            "A": "$\\frac{1}{2}$",
            "B": "$\\frac{1}{3}$",
            "C": "$\\frac{2}{3}$",
            "D": "$\\frac{1}{6}$"
        },
        "ans": "A",
        "exp": "Even outcomes = 3 (2,4,6); total 6; $3/6 = 1/2$."
    },
    {
        "id": "M58",
        "subject": "MATHS",
        "q": "A bag has 3 red and 2 blue balls. Find P(blue).",
        "options": {
            "A": "$\\frac{1}{2}$",
            "B": "$\\frac{2}{5}$",
            "C": "$\\frac{3}{5}$",
            "D": "$\\frac{1}{3}$"
        },
        "ans": "B",
        "exp": "Total = 5, blue = 2, so P(blue) = 2/5."
    },
    {
        "id": "M59",
        "subject": "MATHS",
        "q": "Two coins are tossed. Find P(getting two heads).",
        "options": {
            "A": "$\\frac{1}{4}$",
            "B": "$\\frac{1}{3}$",
            "C": "$\\frac{1}{2}$",
            "D": "$\\frac{3}{4}$"
        },
        "ans": "A",
        "exp": "Outcomes = 4, favorable = 1 (HH), so 1/4."
    },
    {
        "id": "M60",
        "subject": "MATHS",
        "q": "A number is chosen from 1\u201310. Find P(odd).",
        "options": {
            "A": "$\\frac{1}{2}$",
            "B": "$\\frac{3}{5}$",
            "C": "$\\frac{2}{5}$",
            "D": "$\\frac{1}{3}$"
        },
        "ans": "B",
        "exp": "Odd numbers = 5, total = 10 \u2192 5/10 = 1/2."
    },
    {
        "id": "M61",
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
        "id": "M62",
        "subject": "MATHS",
        "q": "Solve for $x$: $2x + 5 = 11$",
        "options": {
            "A": "$x = 2$",
            "B": "$x = 3$",
            "C": "$x = 4$",
            "D": "$x = 5$"
        },
        "ans": "C",
        "exp": "Subtract 5 from both sides: $2x = 6$, divide by 2: $x = 3$."
    },
    {
        "id": "M63",
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
        "id": "M64",
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
        "id": "M65",
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
        "id": "M66",
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
        "id": "M67",
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
        "id": "M68",
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
        "id": "M69",
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
        "id": "M70",
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
        "id": "M71",
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
        "id": "M72",
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
        "id": "M73",
        "subject": "MATHS",
        "q": "Multiply: $\\frac{2}{3} \\times \\frac{3}{5}$",
        "options": {
            "A": "$\\frac{6}{15}$",
            "B": "$\\frac{2}{5}$",
            "C": "$\\frac{3}{8}$",
            "D": "$\\frac{1}{5}$"
        },
        "ans": "A",
        "exp": "Multiply numerators and denominators: $2 \\times 3 = 6$, $3 \\times 5 = 15$."
    },
    {
        "id": "M74",
        "subject": "MATHS",
        "q": "Divide: $\\frac{4}{5} \u00f7 \\frac{2}{3}$",
        "options": {
            "A": "$\\frac{6}{5}$",
            "B": "$\\frac{8}{15}$",
            "C": "$\\frac{5}{6}$",
            "D": "$\\frac{4}{5}$"
        },
        "ans": "A",
        "exp": "Invert divisor and multiply: $\\frac{4}{5} \\times \\frac{3}{2} = \\frac{12}{10} = \\frac{6}{5}$."
    },
    {
        "id": "M75",
        "subject": "MATHS",
        "q": "Simplify: $\\frac{9}{12}$",
        "options": {
            "A": "$\\frac{3}{4}$",
            "B": "$\\frac{4}{5}$",
            "C": "$\\frac{9}{10}$",
            "D": "$\\frac{2}{3}$"
        },
        "ans": "A",
        "exp": "Divide top and bottom by 3: $\\frac{9}{12} = \\frac{3}{4}$."
    },
    {
        "id": "M76",
        "subject": "MATHS",
        "q": "Find the area of a rectangle with length 10 cm and width 5 cm.",
        "options": {
            "A": "$15\\text{ cm}^2$",
            "B": "$25\\text{ cm}^2$",
            "C": "$50\\text{ cm}^2$",
            "D": "$100\\text{ cm}^2$"
        },
        "ans": "C",
        "exp": "Area = length \u00d7 width = $10 \\times 5 = 50\\text{ cm}^2$."
    },
    {
        "id": "M77",
        "subject": "MATHS",
        "q": "Find the circumference of a circle with radius 7 cm. ($\\pi = 22/7$)",
        "options": {
            "A": "$22\\text{ cm}$",
            "B": "$44\\text{ cm}$",
            "C": "$33\\text{ cm}$",
            "D": "$49\\text{ cm}$"
        },
        "ans": "B",
        "exp": "Circumference = $2\\pi r = 2 \\times \\frac{22}{7} \\times 7 = 44$ cm."
    },
    {
        "id": "M78",
        "subject": "MATHS",
        "q": "Find the area of a triangle with base 8 cm and height 5 cm.",
        "options": {
            "A": "$40\\text{ cm}^2$",
            "B": "$20\\text{ cm}^2$",
            "C": "$25\\text{ cm}^2$",
            "D": "$15\\text{ cm}^2$"
        },
        "ans": "B",
        "exp": "Area = $\\frac{1}{2} \\times 8 \\times 5 = 20\\text{ cm}^2$."
    },
    {
        "id": "M79",
        "subject": "MATHS",
        "q": "A cube has a side length of 4 cm. Find its volume.",
        "options": {
            "A": "$64\\text{ cm}^3$",
            "B": "$16\\text{ cm}^3$",
            "C": "$32\\text{ cm}^3$",
            "D": "$48\\text{ cm}^3$"
        },
        "ans": "A",
        "exp": "Volume = side\u00b3 = $4^3 = 64\\text{ cm}^3$."
    },
    {
        "id": "M80",
        "subject": "MATHS",
        "q": "Find the perimeter of a square with side 6 cm.",
        "options": {
            "A": "$12\\text{ cm}$",
            "B": "$24\\text{ cm}$",
            "C": "$18\\text{ cm}$",
            "D": "$36\\text{ cm}$"
        },
        "ans": "B",
        "exp": "Perimeter = 4 \u00d7 side = $4 \\times 6 = 24\\text{ cm}$."
    },
    {
        "id": "M81",
        "subject": "MATHS",
        "q": "Simplify the ratio 12:8.",
        "options": {
            "A": "3:2",
            "B": "2:3",
            "C": "4:3",
            "D": "6:5"
        },
        "ans": "A",
        "exp": "Divide both terms by 4: 12 \u00f7 4 = 3, 8 \u00f7 4 = 2 \u2192 3:2."
    },
    {
        "id": "M82",
        "subject": "MATHS",
        "q": "Divide \u20a6600 in the ratio 2:3.",
        "options": {
            "A": "\u20a6200 and \u20a6400",
            "B": "\u20a6240 and \u20a6360",
            "C": "\u20a6250 and \u20a6350",
            "D": "\u20a6300 and \u20a6300"
        },
        "ans": "B",
        "exp": "Sum = 5 parts; \u20a6600 \u00f7 5 = \u20a6120 per part; \u20a6240 and \u20a6360 respectively."
    },
    {
        "id": "M83",
        "subject": "MATHS",
        "q": "If a map scale is 1:50,000, what distance does 2 cm represent?",
        "options": {
            "A": "1 km",
            "B": "0.5 km",
            "C": "2 km",
            "D": "10 km"
        },
        "ans": "A",
        "exp": "2 cm \u00d7 50,000 = 100,000 cm = 1 km."
    },
    {
        "id": "M84",
        "subject": "MATHS",
        "q": "Express 20 minutes as a fraction of an hour.",
        "options": {
            "A": "1/2",
            "B": "1/3",
            "C": "2/3",
            "D": "1/4"
        },
        "ans": "B",
        "exp": "20 min \u00f7 60 min = 1/3 of an hour."
    },
    {
        "id": "M85",
        "subject": "MATHS",
        "q": "The ratio of boys to girls in a class is 3:2. If there are 15 boys, how many girls?",
        "options": {
            "A": "5",
            "B": "8",
            "C": "10",
            "D": "12"
        },
        "ans": "C",
        "exp": "Each part = 15 \u00f7 3 = 5, girls = 2 \u00d7 5 = 10."
    },
    {
        "id": "M86",
        "subject": "MATHS",
        "q": "A coin is tossed once. Find the probability of getting a head.",
        "options": {
            "A": "$\\frac{1}{2}$",
            "B": "$\\frac{1}{3}$",
            "C": "$1$",
            "D": "$0$"
        },
        "ans": "A",
        "exp": "Two possible outcomes, 1 favorable \u2192 $1/2$."
    },
    {
        "id": "M87",
        "subject": "MATHS",
        "q": "Find the probability of getting an even number on a fair die.",
        "options": {
            "A": "$\\frac{1}{2}$",
            "B": "$\\frac{1}{3}$",
            "C": "$\\frac{2}{3}$",
            "D": "$\\frac{1}{6}$"
        },
        "ans": "A",
        "exp": "Even outcomes = 3 (2,4,6); total 6; $3/6 = 1/2$."
    },
    {
        "id": "M88",
        "subject": "MATHS",
        "q": "A bag has 3 red and 2 blue balls. Find P(blue).",
        "options": {
            "A": "$\\frac{1}{2}$",
            "B": "$\\frac{2}{5}$",
            "C": "$\\frac{3}{5}$",
            "D": "$\\frac{1}{3}$"
        },
        "ans": "B",
        "exp": "Total = 5, blue = 2, so P(blue) = 2/5."
    },
    {
        "id": "M89",
        "subject": "MATHS",
        "q": "Two coins are tossed. Find P(getting two heads).",
        "options": {
            "A": "$\\frac{1}{4}$",
            "B": "$\\frac{1}{3}$",
            "C": "$\\frac{1}{2}$",
            "D": "$\\frac{3}{4}$"
        },
        "ans": "A",
        "exp": "Outcomes = 4, favorable = 1 (HH), so 1/4."
    },
    {
        "id": "M90",
        "subject": "MATHS",
        "q": "A number is chosen from 1\u201310. Find P(odd).",
        "options": {
            "A": "$\\frac{1}{2}$",
            "B": "$\\frac{3}{5}$",
            "C": "$\\frac{2}{5}$",
            "D": "$\\frac{1}{3}$"
        },
        "ans": "B",
        "exp": "Odd numbers = 5, total = 10 \u2192 5/10 = 1/2."
    },
    {
        "id": "M91",
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
        "id": "M92",
        "subject": "MATHS",
        "q": "Solve for $x$: $2x + 5 = 11$",
        "options": {
            "A": "$x = 2$",
            "B": "$x = 3$",
            "C": "$x = 4$",
            "D": "$x = 5$"
        },
        "ans": "C",
        "exp": "Subtract 5 from both sides: $2x = 6$, divide by 2: $x = 3$."
    },
    {
        "id": "M93",
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
        "id": "M94",
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
        "id": "M95",
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
        "id": "M96",
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
        "id": "M97",
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
        "id": "M98",
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
        "id": "M99",
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
        "id": "M100",
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
    // --- ENGLISH LANGUAGE (15 Questions Pool) ---
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
        "q": "Choose the correct usage: He gave a ____ answer to the rude question.",
        "options": {
            "A": "concise",
            "B": "conartist",
            "C": "concrete",
            "D": "conscientious"
        },
        "ans": "A",
        "exp": "'Concise' means brief and to the point."
    },
    {
        "id": "E9",
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
        "id": "E10",
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
        "id": "E11",
        "subject": "ENGLISH",
        "q": "Identify the part of speech of the capitalized word: She QUICKLY finished her work.",
        "options": {
            "A": "Noun",
            "B": "Verb",
            "C": "Adverb",
            "D": "Adjective"
        },
        "ans": "C",
        "exp": "'Quickly' modifies a verb \u2014 it's an adverb."
    },
    {
        "id": "E12",
        "subject": "ENGLISH",
        "q": "Which word is a conjunction in: 'I wanted to go, but it rained.'",
        "options": {
            "A": "wanted",
            "B": "but",
            "C": "rained",
            "D": "to"
        },
        "ans": "B",
        "exp": "'But' connects clauses; it's a conjunction."
    },
    {
        "id": "E13",
        "subject": "ENGLISH",
        "q": "Identify the part of speech: 'Happiness is contagious.' - 'Happiness' is a ____.",
        "options": {
            "A": "Verb",
            "B": "Adjective",
            "C": "Noun",
            "D": "Adverb"
        },
        "ans": "C",
        "exp": "'Happiness' names a thing/feeling \u2014 noun."
    },
    {
        "id": "E14",
        "subject": "ENGLISH",
        "q": "Choose the pronoun in: 'Give the book to her.'",
        "options": {
            "A": "Give",
            "B": "the",
            "C": "her",
            "D": "book"
        },
        "ans": "C",
        "exp": "'Her' refers to a person \u2014 pronoun."
    },
    {
        "id": "E15",
        "subject": "ENGLISH",
        "q": "What is 'beautiful' in the sentence: 'The beautiful painting hung on the wall.'",
        "options": {
            "A": "Noun",
            "B": "Verb",
            "C": "Adverb",
            "D": "Adjective"
        },
        "ans": "D",
        "exp": "'Beautiful' describes the painting \u2014 adjective."
    },
    {
        "id": "E16",
        "subject": "ENGLISH",
        "q": "Choose the correctly punctuated sentence.",
        "options": {
            "A": "Its raining; bring an umbrella.",
            "B": "It's raining; bring an umbrella.",
            "C": "Its' raining, bring an umbrella.",
            "D": "It is' raining bring an umbrella."
        },
        "ans": "B",
        "exp": "Contraction 'It's' and semicolon correctly used."
    },
    {
        "id": "E17",
        "subject": "ENGLISH",
        "q": "Identify the fragment: 'When he arrived at the station.'",
        "options": {
            "A": "When he arrived at the station.",
            "B": "He arrived at the station.",
            "C": "They left early.",
            "D": "She smiled."
        },
        "ans": "A",
        "exp": "Sentence fragment lacks main clause."
    },
    {
        "id": "E18",
        "subject": "ENGLISH",
        "q": "Choose correct parallel structure: 'She likes hiking, swimming, and ____.'",
        "options": {
            "A": "to bike",
            "B": "biking",
            "C": "bikes",
            "D": "bike"
        },
        "ans": "B",
        "exp": "Parallel gerunds: hiking, swimming, biking."
    },
    {
        "id": "E19",
        "subject": "ENGLISH",
        "q": "Select the sentence in passive voice.",
        "options": {
            "A": "The chef cooked the meal.",
            "B": "The meal was cooked by the chef.",
            "C": "They will cook dinner.",
            "D": "She cooks well."
        },
        "ans": "B",
        "exp": "Passive: subject receives action."
    },
    {
        "id": "E20",
        "subject": "ENGLISH",
        "q": "Choose correct sentence combining using relative clause: 'I met a man. He writes novels.'",
        "options": {
            "A": "I met a man who writes novels.",
            "B": "I met a man, he writes novels.",
            "C": "I met a man which writes novels.",
            "D": "I met a man writing novels who."
        },
        "ans": "A",
        "exp": "Use 'who' for people to join clauses."
    },
    {
        "id": "E21",
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
        "id": "E22",
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
        "id": "E23",
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
        "id": "E24",
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
    {
        "id": "E25",
        "subject": "ENGLISH",
        "q": "Identify: 'The silence was deafening.'",
        "options": {
            "A": "Oxymoron",
            "B": "Personification",
            "C": "Hyperbole",
            "D": "Understatement"
        },
        "ans": "C",
        "exp": "Exaggeration for effect = hyperbole."
    },
    {
        "id": "E26",
        "subject": "ENGLISH",
        "q": "Read the sentence: 'Lola planted a sapling; within a year it had grown into a small tree.' Question: What happened within a year?",
        "options": {
            "A": "The sapling died",
            "B": "The sapling grew into a small tree",
            "C": "Lola planted another sapling",
            "D": "It snowed"
        },
        "ans": "B",
        "exp": "The sentence states it grew into a small tree."
    },
    {
        "id": "E27",
        "subject": "ENGLISH",
        "q": "Short passage: 'Marcus studied all night, yet he failed the test.' Question: Why might Marcus have failed despite studying?",
        "options": {
            "A": "He studied the wrong material",
            "B": "He slept during the test",
            "C": "The test was easy",
            "D": "He didn't study"
        },
        "ans": "A",
        "exp": "Contrasting 'yet' implies unexpected result; likely studied wrong material."
    },
    {
        "id": "E28",
        "subject": "ENGLISH",
        "q": "Read: 'Many birds migrate south for the winter.' Question: What does 'migrate' mean here?",
        "options": {
            "A": "Build nests",
            "B": "Fly long distances seasonally",
            "C": "Eat more",
            "D": "Sing loudly"
        },
        "ans": "B",
        "exp": "'Migrate' refers to seasonal long-distance movement."
    },
    {
        "id": "E29",
        "subject": "ENGLISH",
        "q": "Passage: 'The scientist observed the reaction carefully.' Question: What did the scientist do?",
        "options": {
            "A": "Ignored the reaction",
            "B": "Observed carefully",
            "C": "Conducted an unrelated experiment",
            "D": "Left the lab"
        },
        "ans": "B",
        "exp": "Directly stated in passage."
    },
    {
        "id": "E30",
        "subject": "ENGLISH",
        "q": "Read: 'She declined the offer politely.' Question: How did she respond?",
        "options": {
            "A": "Angrily",
            "B": "Politely declined",
            "C": "Accepted",
            "D": "Ignored"
        },
        "ans": "B",
        "exp": "Sentence specifies 'politely'."
    },
    {
        "id": "E31",
        "subject": "ENGLISH",
        "q": "Choose the correct word: He gave an ____ explanation of the procedure.",
        "options": {
            "A": "explicit",
            "B": "explict",
            "C": "explisit",
            "D": "explicate"
        },
        "ans": "A",
        "exp": "'Explicit' means clear and detailed."
    },
    {
        "id": "E32",
        "subject": "ENGLISH",
        "q": "Fill: The manager asked for a ____ report by Monday.",
        "options": {
            "A": "comprehesive",
            "B": "comprehensive",
            "C": "comprehensve",
            "D": "comprehend"
        },
        "ans": "B",
        "exp": "Correct spelling 'comprehensive'."
    },
    {
        "id": "E33",
        "subject": "ENGLISH",
        "q": "Choose correct preposition: She is proficient ____ French.",
        "options": {
            "A": "in",
            "B": "on",
            "C": "at",
            "D": "for"
        },
        "ans": "A",
        "exp": "Use 'proficient in' for languages."
    },
    {
        "id": "E34",
        "subject": "ENGLISH",
        "q": "Select correct collocation: 'Make a ____ decision.'",
        "options": {
            "A": "fast",
            "B": "quick",
            "C": "prompt",
            "D": "done"
        },
        "ans": "C",
        "exp": "'Make a prompt decision' is standard collocation."
    },
    {
        "id": "E35",
        "subject": "ENGLISH",
        "q": "Choose correct register: In formal writing, avoid ____ contractions.",
        "options": {
            "A": "using",
            "B": "used",
            "C": "use",
            "D": "uses"
        },
        "ans": "A",
        "exp": "Use gerund 'using' after 'avoid'."
    },
    {
        "id": "E36",
        "subject": "ENGLISH",
        "q": "Choose the correct spelling:",
        "options": {
            "A": "accommodate",
            "B": "acommodate",
            "C": "accomodate",
            "D": "acomodate"
        },
        "ans": "A",
        "exp": "Correct spelling 'accommodate' with double 'c' and double 'm'."
    },
    {
        "id": "E37",
        "subject": "ENGLISH",
        "q": "Choose correct punctuation: Which is correct?",
        "options": {
            "A": "She asked, 'Are you coming?'",
            "B": "She asked 'Are you coming?'",
            "C": "She asked Are you coming?",
            "D": "She asked: 'Are you coming?'"
        },
        "ans": "A",
        "exp": "Comma before quotation in standard punctuation."
    },
    {
        "id": "E38",
        "subject": "ENGLISH",
        "q": "Which is correctly capitalized?",
        "options": {
            "A": "the President of nigeria",
            "B": "The president of Nigeria",
            "C": "The President of Nigeria",
            "D": "the President Of Nigeria"
        },
        "ans": "C",
        "exp": "Formal title and country proper noun capitalized."
    },
    {
        "id": "E39",
        "subject": "ENGLISH",
        "q": "Choose correct homophone: 'Their/There/They're going to arrive soon.'",
        "options": {
            "A": "Their",
            "B": "There",
            "C": "They're",
            "D": "Thare"
        },
        "ans": "C",
        "exp": "'They're' = 'they are' fits sentence."
    },
    {
        "id": "E40",
        "subject": "ENGLISH",
        "q": "Select correct apostrophe use: Plural of 'child' is ____.",
        "options": {
            "A": "childs",
            "B": "child's",
            "C": "children",
            "D": "childes"
        },
        "ans": "C",
        "exp": "Irregular plural is 'children'."
    },
    {
        "id": "E41",
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
        "id": "E42",
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
        "id": "E43",
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
        "id": "E44",
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
        "id": "E45",
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
        "id": "E46",
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
        "id": "E47",
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
        "id": "E48",
        "subject": "ENGLISH",
        "q": "Choose the correct usage: He gave a ____ answer to the rude question.",
        "options": {
            "A": "concise",
            "B": "conartist",
            "C": "concrete",
            "D": "conscientious"
        },
        "ans": "A",
        "exp": "'Concise' means brief and to the point."
    },
    {
        "id": "E49",
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
        "id": "E50",
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
        "id": "E51",
        "subject": "ENGLISH",
        "q": "Identify the part of speech of the capitalized word: She QUICKLY finished her work.",
        "options": {
            "A": "Noun",
            "B": "Verb",
            "C": "Adverb",
            "D": "Adjective"
        },
        "ans": "C",
        "exp": "'Quickly' modifies a verb \u2014 it's an adverb."
    },
    {
        "id": "E52",
        "subject": "ENGLISH",
        "q": "Which word is a conjunction in: 'I wanted to go, but it rained.'",
        "options": {
            "A": "wanted",
            "B": "but",
            "C": "rained",
            "D": "to"
        },
        "ans": "B",
        "exp": "'But' connects clauses; it's a conjunction."
    },
    {
        "id": "E53",
        "subject": "ENGLISH",
        "q": "Identify the part of speech: 'Happiness is contagious.' - 'Happiness' is a ____.",
        "options": {
            "A": "Verb",
            "B": "Adjective",
            "C": "Noun",
            "D": "Adverb"
        },
        "ans": "C",
        "exp": "'Happiness' names a thing/feeling \u2014 noun."
    },
    {
        "id": "E54",
        "subject": "ENGLISH",
        "q": "Choose the pronoun in: 'Give the book to her.'",
        "options": {
            "A": "Give",
            "B": "the",
            "C": "her",
            "D": "book"
        },
        "ans": "C",
        "exp": "'Her' refers to a person \u2014 pronoun."
    },
    {
        "id": "E55",
        "subject": "ENGLISH",
        "q": "What is 'beautiful' in the sentence: 'The beautiful painting hung on the wall.'",
        "options": {
            "A": "Noun",
            "B": "Verb",
            "C": "Adverb",
            "D": "Adjective"
        },
        "ans": "D",
        "exp": "'Beautiful' describes the painting \u2014 adjective."
    },
    {
        "id": "E56",
        "subject": "ENGLISH",
        "q": "Choose the correctly punctuated sentence.",
        "options": {
            "A": "Its raining; bring an umbrella.",
            "B": "It's raining; bring an umbrella.",
            "C": "Its' raining, bring an umbrella.",
            "D": "It is' raining bring an umbrella."
        },
        "ans": "B",
        "exp": "Contraction 'It's' and semicolon correctly used."
    },
    {
        "id": "E57",
        "subject": "ENGLISH",
        "q": "Identify the fragment: 'When he arrived at the station.'",
        "options": {
            "A": "When he arrived at the station.",
            "B": "He arrived at the station.",
            "C": "They left early.",
            "D": "She smiled."
        },
        "ans": "A",
        "exp": "Sentence fragment lacks main clause."
    },
    {
        "id": "E58",
        "subject": "ENGLISH",
        "q": "Choose correct parallel structure: 'She likes hiking, swimming, and ____.'",
        "options": {
            "A": "to bike",
            "B": "biking",
            "C": "bikes",
            "D": "bike"
        },
        "ans": "B",
        "exp": "Parallel gerunds: hiking, swimming, biking."
    },
    {
        "id": "E59",
        "subject": "ENGLISH",
        "q": "Select the sentence in passive voice.",
        "options": {
            "A": "The chef cooked the meal.",
            "B": "The meal was cooked by the chef.",
            "C": "They will cook dinner.",
            "D": "She cooks well."
        },
        "ans": "B",
        "exp": "Passive: subject receives action."
    },
    {
        "id": "E60",
        "subject": "ENGLISH",
        "q": "Choose correct sentence combining using relative clause: 'I met a man. He writes novels.'",
        "options": {
            "A": "I met a man who writes novels.",
            "B": "I met a man, he writes novels.",
            "C": "I met a man which writes novels.",
            "D": "I met a man writing novels who."
        },
        "ans": "A",
        "exp": "Use 'who' for people to join clauses."
    },
    {
        "id": "E61",
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
        "id": "E62",
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
        "id": "E63",
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
        "id": "E64",
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
    {
        "id": "E65",
        "subject": "ENGLISH",
        "q": "Identify: 'The silence was deafening.'",
        "options": {
            "A": "Oxymoron",
            "B": "Personification",
            "C": "Hyperbole",
            "D": "Understatement"
        },
        "ans": "C",
        "exp": "Exaggeration for effect = hyperbole."
    },
    {
        "id": "E66",
        "subject": "ENGLISH",
        "q": "Read the sentence: 'Lola planted a sapling; within a year it had grown into a small tree.' Question: What happened within a year?",
        "options": {
            "A": "The sapling died",
            "B": "The sapling grew into a small tree",
            "C": "Lola planted another sapling",
            "D": "It snowed"
        },
        "ans": "B",
        "exp": "The sentence states it grew into a small tree."
    },
    {
        "id": "E67",
        "subject": "ENGLISH",
        "q": "Short passage: 'Marcus studied all night, yet he failed the test.' Question: Why might Marcus have failed despite studying?",
        "options": {
            "A": "He studied the wrong material",
            "B": "He slept during the test",
            "C": "The test was easy",
            "D": "He didn't study"
        },
        "ans": "A",
        "exp": "Contrasting 'yet' implies unexpected result; likely studied wrong material."
    },
    {
        "id": "E68",
        "subject": "ENGLISH",
        "q": "Read: 'Many birds migrate south for the winter.' Question: What does 'migrate' mean here?",
        "options": {
            "A": "Build nests",
            "B": "Fly long distances seasonally",
            "C": "Eat more",
            "D": "Sing loudly"
        },
        "ans": "B",
        "exp": "'Migrate' refers to seasonal long-distance movement."
    },
    {
        "id": "E69",
        "subject": "ENGLISH",
        "q": "Passage: 'The scientist observed the reaction carefully.' Question: What did the scientist do?",
        "options": {
            "A": "Ignored the reaction",
            "B": "Observed carefully",
            "C": "Conducted an unrelated experiment",
            "D": "Left the lab"
        },
        "ans": "B",
        "exp": "Directly stated in passage."
    },
    {
        "id": "E70",
        "subject": "ENGLISH",
        "q": "Read: 'She declined the offer politely.' Question: How did she respond?",
        "options": {
            "A": "Angrily",
            "B": "Politely declined",
            "C": "Accepted",
            "D": "Ignored"
        },
        "ans": "B",
        "exp": "Sentence specifies 'politely'."
    },
    {
        "id": "E71",
        "subject": "ENGLISH",
        "q": "Choose the correct word: He gave an ____ explanation of the procedure.",
        "options": {
            "A": "explicit",
            "B": "explict",
            "C": "explisit",
            "D": "explicate"
        },
        "ans": "A",
        "exp": "'Explicit' means clear and detailed."
    },
    {
        "id": "E72",
        "subject": "ENGLISH",
        "q": "Fill: The manager asked for a ____ report by Monday.",
        "options": {
            "A": "comprehesive",
            "B": "comprehensive",
            "C": "comprehensve",
            "D": "comprehend"
        },
        "ans": "B",
        "exp": "Correct spelling 'comprehensive'."
    },
    {
        "id": "E73",
        "subject": "ENGLISH",
        "q": "Choose correct preposition: She is proficient ____ French.",
        "options": {
            "A": "in",
            "B": "on",
            "C": "at",
            "D": "for"
        },
        "ans": "A",
        "exp": "Use 'proficient in' for languages."
    },
    {
        "id": "E74",
        "subject": "ENGLISH",
        "q": "Select correct collocation: 'Make a ____ decision.'",
        "options": {
            "A": "fast",
            "B": "quick",
            "C": "prompt",
            "D": "done"
        },
        "ans": "C",
        "exp": "'Make a prompt decision' is standard collocation."
    },
    {
        "id": "E75",
        "subject": "ENGLISH",
        "q": "Choose correct register: In formal writing, avoid ____ contractions.",
        "options": {
            "A": "using",
            "B": "used",
            "C": "use",
            "D": "uses"
        },
        "ans": "A",
        "exp": "Use gerund 'using' after 'avoid'."
    },
    {
        "id": "E76",
        "subject": "ENGLISH",
        "q": "Choose the correct spelling:",
        "options": {
            "A": "accommodate",
            "B": "acommodate",
            "C": "accomodate",
            "D": "acomodate"
        },
        "ans": "A",
        "exp": "Correct spelling 'accommodate' with double 'c' and double 'm'."
    },
    {
        "id": "E77",
        "subject": "ENGLISH",
        "q": "Choose correct punctuation: Which is correct?",
        "options": {
            "A": "She asked, 'Are you coming?'",
            "B": "She asked 'Are you coming?'",
            "C": "She asked Are you coming?",
            "D": "She asked: 'Are you coming?'"
        },
        "ans": "A",
        "exp": "Comma before quotation in standard punctuation."
    },
    {
        "id": "E78",
        "subject": "ENGLISH",
        "q": "Which is correctly capitalized?",
        "options": {
            "A": "the President of nigeria",
            "B": "The president of Nigeria",
            "C": "The President of Nigeria",
            "D": "the President Of Nigeria"
        },
        "ans": "C",
        "exp": "Formal title and country proper noun capitalized."
    },
    {
        "id": "E79",
        "subject": "ENGLISH",
        "q": "Choose correct homophone: 'Their/There/They're going to arrive soon.'",
        "options": {
            "A": "Their",
            "B": "There",
            "C": "They're",
            "D": "Thare"
        },
        "ans": "C",
        "exp": "'They're' = 'they are' fits sentence."
    },
    {
        "id": "E80",
        "subject": "ENGLISH",
        "q": "Select correct apostrophe use: Plural of 'child' is ____.",
        "options": {
            "A": "childs",
            "B": "child's",
            "C": "children",
            "D": "childes"
        },
        "ans": "C",
        "exp": "Irregular plural is 'children'."
    },
    {
        "id": "E81",
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
        "id": "E82",
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
        "id": "E83",
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
        "id": "E84",
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
        "id": "E85",
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
        "id": "E86",
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
        "id": "E87",
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
        "id": "E88",
        "subject": "ENGLISH",
        "q": "Choose the correct usage: He gave a ____ answer to the rude question.",
        "options": {
            "A": "concise",
            "B": "conartist",
            "C": "concrete",
            "D": "conscientious"
        },
        "ans": "A",
        "exp": "'Concise' means brief and to the point."
    },
    {
        "id": "E89",
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
        "id": "E90",
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
        "id": "E91",
        "subject": "ENGLISH",
        "q": "Identify the part of speech of the capitalized word: She QUICKLY finished her work.",
        "options": {
            "A": "Noun",
            "B": "Verb",
            "C": "Adverb",
            "D": "Adjective"
        },
        "ans": "C",
        "exp": "'Quickly' modifies a verb \u2014 it's an adverb."
    },
    {
        "id": "E92",
        "subject": "ENGLISH",
        "q": "Which word is a conjunction in: 'I wanted to go, but it rained.'",
        "options": {
            "A": "wanted",
            "B": "but",
            "C": "rained",
            "D": "to"
        },
        "ans": "B",
        "exp": "'But' connects clauses; it's a conjunction."
    },
    {
        "id": "E93",
        "subject": "ENGLISH",
        "q": "Identify the part of speech: 'Happiness is contagious.' - 'Happiness' is a ____.",
        "options": {
            "A": "Verb",
            "B": "Adjective",
            "C": "Noun",
            "D": "Adverb"
        },
        "ans": "C",
        "exp": "'Happiness' names a thing/feeling \u2014 noun."
    },
    {
        "id": "E94",
        "subject": "ENGLISH",
        "q": "Choose the pronoun in: 'Give the book to her.'",
        "options": {
            "A": "Give",
            "B": "the",
            "C": "her",
            "D": "book"
        },
        "ans": "C",
        "exp": "'Her' refers to a person \u2014 pronoun."
    },
    {
        "id": "E95",
        "subject": "ENGLISH",
        "q": "What is 'beautiful' in the sentence: 'The beautiful painting hung on the wall.'",
        "options": {
            "A": "Noun",
            "B": "Verb",
            "C": "Adverb",
            "D": "Adjective"
        },
        "ans": "D",
        "exp": "'Beautiful' describes the painting \u2014 adjective."
    },
    {
        "id": "E96",
        "subject": "ENGLISH",
        "q": "Choose the correctly punctuated sentence.",
        "options": {
            "A": "Its raining; bring an umbrella.",
            "B": "It's raining; bring an umbrella.",
            "C": "Its' raining, bring an umbrella.",
            "D": "It is' raining bring an umbrella."
        },
        "ans": "B",
        "exp": "Contraction 'It's' and semicolon correctly used."
    },
    {
        "id": "E97",
        "subject": "ENGLISH",
        "q": "Identify the fragment: 'When he arrived at the station.'",
        "options": {
            "A": "When he arrived at the station.",
            "B": "He arrived at the station.",
            "C": "They left early.",
            "D": "She smiled."
        },
        "ans": "A",
        "exp": "Sentence fragment lacks main clause."
    },
    {
        "id": "E98",
        "subject": "ENGLISH",
        "q": "Choose correct parallel structure: 'She likes hiking, swimming, and ____.'",
        "options": {
            "A": "to bike",
            "B": "biking",
            "C": "bikes",
            "D": "bike"
        },
        "ans": "B",
        "exp": "Parallel gerunds: hiking, swimming, biking."
    },
    {
        "id": "E99",
        "subject": "ENGLISH",
        "q": "Select the sentence in passive voice.",
        "options": {
            "A": "The chef cooked the meal.",
            "B": "The meal was cooked by the chef.",
            "C": "They will cook dinner.",
            "D": "She cooks well."
        },
        "ans": "B",
        "exp": "Passive: subject receives action."
    },
    {
        "id": "E100",
        "subject": "ENGLISH",
        "q": "Choose correct sentence combining using relative clause: 'I met a man. He writes novels.'",
        "options": {
            "A": "I met a man who writes novels.",
            "B": "I met a man, he writes novels.",
            "C": "I met a man which writes novels.",
            "D": "I met a man writing novels who."
        },
        "ans": "A",
        "exp": "Use 'who' for people to join clauses."
    },

    // --- GENERAL KNOWLEDGE (20 Questions Pool) ---
    {
        "id": "G1",
        "subject": "GENERAL KNOWLEDGE",
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
        "subject": "GENERAL KNOWLEDGE",
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
        "subject": "GENERAL KNOWLEDGE",
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
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G5",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G6",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G7",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G8",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G9",
        "subject": "GENERAL KNOWLEDGE",
        "q": "Who is the current Governor of Lagos State?",
        "options": {
            "A": "Babajide Sanwo-Olu",
            "B": "Akinwunmi Ambode",
            "C": "Kayode Fayemi",
            "D": "Dapo Abiodun"
        },
        "ans": "A",
        "exp": "Babajide Sanwo-Olu has been governor since 2019."
    },
    {
        "id": "G10",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G11",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G12",
        "subject": "GENERAL KNOWLEDGE",
        "q": "Which Nigerian state is known as the \u2018Coal City State\u2019?",
        "options": {
            "A": "Kano",
            "B": "Enugu",
            "C": "Jos",
            "D": "Ogun"
        },
        "ans": "B",
        "exp": "Enugu is nicknamed the 'Coal City State' due to its coal deposits."
    },
    {
        "id": "G13",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G14",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G15",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G16",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G17",
        "subject": "GENERAL KNOWLEDGE",
        "q": "What is the name of Nigeria\u2019s legislative building?",
        "options": {
            "A": "House of Assembly",
            "B": "The Villa",
            "C": "National Assembly Complex",
            "D": "Unity House"
        },
        "ans": "C",
        "exp": "The National Assembly Complex in Abuja houses the Senate and House of Representatives."
    },
    {
        "id": "G18",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G19",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G20",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G21",
        "subject": "GENERAL KNOWLEDGE",
        "q": "Which Nigerian state is known as the \u2018Coal City State\u2019?",
        "options": {
            "A": "Kano",
            "B": "Enugu",
            "C": "Jos",
            "D": "Ogun"
        },
        "ans": "B",
        "exp": "Enugu is nicknamed the 'Coal City State' due to its coal deposits."
    },
    {
        "id": "G22",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G23",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G24",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G25",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G26",
        "subject": "GENERAL KNOWLEDGE",
        "q": "What is the color of the Nigerian flag?",
        "options": {
            "A": "Green and White",
            "B": "Green, White, Green",
            "C": "White and Green",
            "D": "Green and Black"
        },
        "ans": "B",
        "exp": "The flag consists of three vertical stripes: green, white, green."
    },
    {
        "id": "G27",
        "subject": "GENERAL KNOWLEDGE",
        "q": "Which Nigerian author wrote 'Things Fall Apart'?",
        "options": {
            "A": "Wole Soyinka",
            "B": "Chimamanda Adichie",
            "C": "Chinua Achebe",
            "D": "Ben Okri"
        },
        "ans": "C",
        "exp": "'Things Fall Apart' was written by Chinua Achebe in 1958."
    },
    {
        "id": "G28",
        "subject": "GENERAL KNOWLEDGE",
        "q": "Who is the current Governor of Lagos State?",
        "options": {
            "A": "Babajide Sanwo-Olu",
            "B": "Akinwunmi Ambode",
            "C": "Kayode Fayemi",
            "D": "Dapo Abiodun"
        },
        "ans": "A",
        "exp": "Babajide Sanwo-Olu has been governor since 2019."
    },
    {
        "id": "G29",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G30",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G31",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G32",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G33",
        "subject": "GENERAL KNOWLEDGE",
        "q": "Which Nigerian state is known as the \u2018Coal City State\u2019?",
        "options": {
            "A": "Kano",
            "B": "Enugu",
            "C": "Jos",
            "D": "Ogun"
        },
        "ans": "B",
        "exp": "Enugu is nicknamed the 'Coal City State' due to its coal deposits."
    },
    {
        "id": "G34",
        "subject": "GENERAL KNOWLEDGE",
        "q": "Who is the current Governor of Lagos State?",
        "options": {
            "A": "Babajide Sanwo-Olu",
            "B": "Akinwunmi Ambode",
            "C": "Kayode Fayemi",
            "D": "Dapo Abiodun"
        },
        "ans": "A",
        "exp": "Babajide Sanwo-Olu has been governor since 2019."
    },
    {
        "id": "G35",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G36",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G37",
        "subject": "GENERAL KNOWLEDGE",
        "q": "Which Nigerian footballer won the 1995 FIFA World Player of the Year?",
        "options": {
            "A": "Austin Okocha",
            "B": "Nwankwo Kanu",
            "C": "Victor Osimhen",
            "D": "Rashidi Yekini"
        },
        "ans": "B",
        "exp": "Nwankwo Kanu won the FIFA U-17 and Olympic gold, and was African Footballer of the Year twice."
    },
    {
        "id": "G38",
        "subject": "GENERAL KNOWLEDGE",
        "q": "What is the name of Nigeria\u2019s legislative building?",
        "options": {
            "A": "House of Assembly",
            "B": "The Villa",
            "C": "National Assembly Complex",
            "D": "Unity House"
        },
        "ans": "C",
        "exp": "The National Assembly Complex in Abuja houses the Senate and House of Representatives."
    },
    {
        "id": "G39",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G40",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G41",
        "subject": "GENERAL KNOWLEDGE",
        "q": "Which Nigerian author wrote 'Things Fall Apart'?",
        "options": {
            "A": "Wole Soyinka",
            "B": "Chimamanda Adichie",
            "C": "Chinua Achebe",
            "D": "Ben Okri"
        },
        "ans": "C",
        "exp": "'Things Fall Apart' was written by Chinua Achebe in 1958."
    },
    {
        "id": "G42",
        "subject": "GENERAL KNOWLEDGE",
        "q": "Which Nigerian footballer won the 1995 FIFA World Player of the Year?",
        "options": {
            "A": "Austin Okocha",
            "B": "Nwankwo Kanu",
            "C": "Victor Osimhen",
            "D": "Rashidi Yekini"
        },
        "ans": "B",
        "exp": "Nwankwo Kanu won the FIFA U-17 and Olympic gold, and was African Footballer of the Year twice."
    },
    {
        "id": "G43",
        "subject": "GENERAL KNOWLEDGE",
        "q": "Who is the current Governor of Lagos State?",
        "options": {
            "A": "Babajide Sanwo-Olu",
            "B": "Akinwunmi Ambode",
            "C": "Kayode Fayemi",
            "D": "Dapo Abiodun"
        },
        "ans": "A",
        "exp": "Babajide Sanwo-Olu has been governor since 2019."
    },
    {
        "id": "G44",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G45",
        "subject": "GENERAL KNOWLEDGE",
        "q": "Which Nigerian footballer won the 1995 FIFA World Player of the Year?",
        "options": {
            "A": "Austin Okocha",
            "B": "Nwankwo Kanu",
            "C": "Victor Osimhen",
            "D": "Rashidi Yekini"
        },
        "ans": "B",
        "exp": "Nwankwo Kanu won the FIFA U-17 and Olympic gold, and was African Footballer of the Year twice."
    },
    {
        "id": "G46",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G47",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G48",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G49",
        "subject": "GENERAL KNOWLEDGE",
        "q": "What is the name of Nigeria\u2019s legislative building?",
        "options": {
            "A": "House of Assembly",
            "B": "The Villa",
            "C": "National Assembly Complex",
            "D": "Unity House"
        },
        "ans": "C",
        "exp": "The National Assembly Complex in Abuja houses the Senate and House of Representatives."
    },
    {
        "id": "G50",
        "subject": "GENERAL KNOWLEDGE",
        "q": "Which is Nigeria\u2019s highest mountain?",
        "options": {
            "A": "Mount Patti",
            "B": "Chappal Waddi",
            "C": "Shere Hills",
            "D": "Obudu Hill"
        },
        "ans": "B",
        "exp": "Chappal Waddi, in Taraba State, is Nigeria\u2019s highest mountain."
    },
    {
        "id": "G51",
        "subject": "GENERAL KNOWLEDGE",
        "q": "Which Nigerian state is known as the \u2018Coal City State\u2019?",
        "options": {
            "A": "Kano",
            "B": "Enugu",
            "C": "Jos",
            "D": "Ogun"
        },
        "ans": "B",
        "exp": "Enugu is nicknamed the 'Coal City State' due to its coal deposits."
    },
    {
        "id": "G52",
        "subject": "GENERAL KNOWLEDGE",
        "q": "Which Nigerian state is known as the \u2018Coal City State\u2019?",
        "options": {
            "A": "Kano",
            "B": "Enugu",
            "C": "Jos",
            "D": "Ogun"
        },
        "ans": "B",
        "exp": "Enugu is nicknamed the 'Coal City State' due to its coal deposits."
    },
    {
        "id": "G53",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G54",
        "subject": "GENERAL KNOWLEDGE",
        "q": "What is the color of the Nigerian flag?",
        "options": {
            "A": "Green and White",
            "B": "Green, White, Green",
            "C": "White and Green",
            "D": "Green and Black"
        },
        "ans": "B",
        "exp": "The flag consists of three vertical stripes: green, white, green."
    },
    {
        "id": "G55",
        "subject": "GENERAL KNOWLEDGE",
        "q": "Who is the current Governor of Lagos State?",
        "options": {
            "A": "Babajide Sanwo-Olu",
            "B": "Akinwunmi Ambode",
            "C": "Kayode Fayemi",
            "D": "Dapo Abiodun"
        },
        "ans": "A",
        "exp": "Babajide Sanwo-Olu has been governor since 2019."
    },
    {
        "id": "G56",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G57",
        "subject": "GENERAL KNOWLEDGE",
        "q": "What is Nigeria\u2019s official currency?",
        "options": {
            "A": "Dollar",
            "B": "Cedi",
            "C": "Naira",
            "D": "Pound"
        },
        "ans": "C",
        "exp": "The Naira (\u20a6) is the official currency of Nigeria."
    },
    {
        "id": "G58",
        "subject": "GENERAL KNOWLEDGE",
        "q": "What is the name of Nigeria\u2019s legislative building?",
        "options": {
            "A": "House of Assembly",
            "B": "The Villa",
            "C": "National Assembly Complex",
            "D": "Unity House"
        },
        "ans": "C",
        "exp": "The National Assembly Complex in Abuja houses the Senate and House of Representatives."
    },
    {
        "id": "G59",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G60",
        "subject": "GENERAL KNOWLEDGE",
        "q": "What is Nigeria\u2019s official currency?",
        "options": {
            "A": "Dollar",
            "B": "Cedi",
            "C": "Naira",
            "D": "Pound"
        },
        "ans": "C",
        "exp": "The Naira (\u20a6) is the official currency of Nigeria."
    },
    {
        "id": "G61",
        "subject": "GENERAL KNOWLEDGE",
        "q": "Which Nigerian author wrote 'Things Fall Apart'?",
        "options": {
            "A": "Wole Soyinka",
            "B": "Chimamanda Adichie",
            "C": "Chinua Achebe",
            "D": "Ben Okri"
        },
        "ans": "C",
        "exp": "'Things Fall Apart' was written by Chinua Achebe in 1958."
    },
    {
        "id": "G62",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G63",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G64",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G65",
        "subject": "GENERAL KNOWLEDGE",
        "q": "Which Nigerian state is known as the \u2018Coal City State\u2019?",
        "options": {
            "A": "Kano",
            "B": "Enugu",
            "C": "Jos",
            "D": "Ogun"
        },
        "ans": "B",
        "exp": "Enugu is nicknamed the 'Coal City State' due to its coal deposits."
    },
    {
        "id": "G66",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G67",
        "subject": "GENERAL KNOWLEDGE",
        "q": "What is the color of the Nigerian flag?",
        "options": {
            "A": "Green and White",
            "B": "Green, White, Green",
            "C": "White and Green",
            "D": "Green and Black"
        },
        "ans": "B",
        "exp": "The flag consists of three vertical stripes: green, white, green."
    },
    {
        "id": "G68",
        "subject": "GENERAL KNOWLEDGE",
        "q": "Which Nigerian footballer won the 1995 FIFA World Player of the Year?",
        "options": {
            "A": "Austin Okocha",
            "B": "Nwankwo Kanu",
            "C": "Victor Osimhen",
            "D": "Rashidi Yekini"
        },
        "ans": "B",
        "exp": "Nwankwo Kanu won the FIFA U-17 and Olympic gold, and was African Footballer of the Year twice."
    },
    {
        "id": "G69",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G70",
        "subject": "GENERAL KNOWLEDGE",
        "q": "Which Nigerian footballer won the 1995 FIFA World Player of the Year?",
        "options": {
            "A": "Austin Okocha",
            "B": "Nwankwo Kanu",
            "C": "Victor Osimhen",
            "D": "Rashidi Yekini"
        },
        "ans": "B",
        "exp": "Nwankwo Kanu won the FIFA U-17 and Olympic gold, and was African Footballer of the Year twice."
    },
    {
        "id": "G71",
        "subject": "GENERAL KNOWLEDGE",
        "q": "Which Nigerian author wrote 'Things Fall Apart'?",
        "options": {
            "A": "Wole Soyinka",
            "B": "Chimamanda Adichie",
            "C": "Chinua Achebe",
            "D": "Ben Okri"
        },
        "ans": "C",
        "exp": "'Things Fall Apart' was written by Chinua Achebe in 1958."
    },
    {
        "id": "G72",
        "subject": "GENERAL KNOWLEDGE",
        "q": "Who is the current Governor of Lagos State?",
        "options": {
            "A": "Babajide Sanwo-Olu",
            "B": "Akinwunmi Ambode",
            "C": "Kayode Fayemi",
            "D": "Dapo Abiodun"
        },
        "ans": "A",
        "exp": "Babajide Sanwo-Olu has been governor since 2019."
    },
    {
        "id": "G73",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G74",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G75",
        "subject": "GENERAL KNOWLEDGE",
        "q": "What is the name of Nigeria\u2019s legislative building?",
        "options": {
            "A": "House of Assembly",
            "B": "The Villa",
            "C": "National Assembly Complex",
            "D": "Unity House"
        },
        "ans": "C",
        "exp": "The National Assembly Complex in Abuja houses the Senate and House of Representatives."
    },
    {
        "id": "G76",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G77",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G78",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G79",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G80",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G81",
        "subject": "GENERAL KNOWLEDGE",
        "q": "What is the capital city of Nigeria?",
        "options": {
            "A": "Lagos",
            "B": "Abuja",
            "C": "Kano",
            "D": "Port Harcourt"
        },
        "ans": "B",
        "exp": "Abuja became the capital of Nigeria in 1991, replacing Lagos."
    },
    {
        "id": "G82",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G83",
        "subject": "GENERAL KNOWLEDGE",
        "q": "Which is Nigeria\u2019s highest mountain?",
        "options": {
            "A": "Mount Patti",
            "B": "Chappal Waddi",
            "C": "Shere Hills",
            "D": "Obudu Hill"
        },
        "ans": "B",
        "exp": "Chappal Waddi, in Taraba State, is Nigeria\u2019s highest mountain."
    },
    {
        "id": "G84",
        "subject": "GENERAL KNOWLEDGE",
        "q": "What is the color of the Nigerian flag?",
        "options": {
            "A": "Green and White",
            "B": "Green, White, Green",
            "C": "White and Green",
            "D": "Green and Black"
        },
        "ans": "B",
        "exp": "The flag consists of three vertical stripes: green, white, green."
    },
    {
        "id": "G85",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G86",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G87",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G88",
        "subject": "GENERAL KNOWLEDGE",
        "q": "Which Nigerian state is known as the \u2018Coal City State\u2019?",
        "options": {
            "A": "Kano",
            "B": "Enugu",
            "C": "Jos",
            "D": "Ogun"
        },
        "ans": "B",
        "exp": "Enugu is nicknamed the 'Coal City State' due to its coal deposits."
    },
    {
        "id": "G89",
        "subject": "GENERAL KNOWLEDGE",
        "q": "Which Nigerian author wrote 'Things Fall Apart'?",
        "options": {
            "A": "Wole Soyinka",
            "B": "Chimamanda Adichie",
            "C": "Chinua Achebe",
            "D": "Ben Okri"
        },
        "ans": "C",
        "exp": "'Things Fall Apart' was written by Chinua Achebe in 1958."
    },
    {
        "id": "G90",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G91",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G92",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G93",
        "subject": "GENERAL KNOWLEDGE",
        "q": "What is the name of Nigeria\u2019s legislative building?",
        "options": {
            "A": "House of Assembly",
            "B": "The Villa",
            "C": "National Assembly Complex",
            "D": "Unity House"
        },
        "ans": "C",
        "exp": "The National Assembly Complex in Abuja houses the Senate and House of Representatives."
    },
    {
        "id": "G94",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G95",
        "subject": "GENERAL KNOWLEDGE",
        "q": "What is the color of the Nigerian flag?",
        "options": {
            "A": "Green and White",
            "B": "Green, White, Green",
            "C": "White and Green",
            "D": "Green and Black"
        },
        "ans": "B",
        "exp": "The flag consists of three vertical stripes: green, white, green."
    },
    {
        "id": "G96",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G97",
        "subject": "GENERAL KNOWLEDGE",
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
        "id": "G98",
        "subject": "GENERAL KNOWLEDGE",
        "q": "Which Nigerian footballer won the 1995 FIFA World Player of the Year?",
        "options": {
            "A": "Austin Okocha",
            "B": "Nwankwo Kanu",
            "C": "Victor Osimhen",
            "D": "Rashidi Yekini"
        },
        "ans": "B",
        "exp": "Nwankwo Kanu won the FIFA U-17 and Olympic gold, and was African Footballer of the Year twice."
    },
    {
        "id": "G99",
        "subject": "GENERAL KNOWLEDGE",
        "q": "What is the name of Nigeria\u2019s legislative building?",
        "options": {
            "A": "House of Assembly",
            "B": "The Villa",
            "C": "National Assembly Complex",
            "D": "Unity House"
        },
        "ans": "C",
        "exp": "The National Assembly Complex in Abuja houses the Senate and House of Representatives."
    },
    {
        "id": "G100",
        "subject": "GENERAL KNOWLEDGE",
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
    
    // --- DEPARTMENTAL QUESTIONS (60 Questions Pool, organized by subject) ---

    // IMMIGRATION SERVICE (NIS) - 15 Questions Pool
    { id: 'I1', subject: 'IMMIGRATION_NIS', q: 'Which body manages immigration and border control in Nigeria?', options: { A: 'NDLEA', B: 'NIS', C: 'EFCC', D: 'FRSC' }, ans: 'B', exp: 'NIS (Nigeria Immigration Service) manages immigration.' },
    { id: 'I2', subject: 'IMMIGRATION_NIS', q: 'Who is the operational head of the Nigeria Immigration Service?', options: { A: 'Inspector General of Police', B: 'Comptroller General of Immigration', C: 'Commandant General', D: 'Director General' }, ans: 'B', exp: 'The Comptroller General of Immigration (CGI) heads the NIS.' },
    { id: 'I3', subject: 'IMMIGRATION_NIS', q: 'What is the NIS responsible for issuing to Nigerian citizens?', options: { A: 'National ID Card', B: 'International Passport', C: 'Voter’s Card', D: 'Driver’s License' }, ans: 'B', exp: 'NIS is solely responsible for issuing International Passports.' },
    { id: 'I4', subject: 'IMMIGRATION_NIS', q: 'The official color of the NIS uniform is predominantly:', options: { A: 'Black', B: 'Khaki/Brown', C: 'Green', D: 'Blue' }, ans: 'D', exp: 'The NIS uniform is predominantly blue.' },
    { id: 'I5', subject: 'IMMIGRATION_NIS', q: 'The NIS handles all of Nigeria’s borders, including:', options: { A: 'Airports only', B: 'Seaports only', C: 'Land borders only', D: 'All points of entry and exit' }, ans: 'D', exp: 'NIS covers all official ports of entry and exit (air, land, and sea).' },
    { id: 'I6', subject: 'IMMIGRATION_NIS', q: 'NIS is responsible for the deportation of:', options: { A: 'Nigerian citizens', B: 'Illegal immigrants', C: 'Military personnel', D: 'Diplomats' }, ans: 'B', exp: 'NIS handles the repatriation or deportation of foreign nationals who violate immigration laws.' },
    { id: 'I7', subject: 'IMMIGRATION_NIS', q: 'The NIS is under the supervision of which Ministry?', options: { A: 'Defence', B: 'Interior', C: 'Foreign Affairs', D: 'Justice' }, ans: 'B', exp: 'The Ministry of Interior oversees the NIS.' },
    { id: 'I8', subject: 'IMMIGRATION_NIS', q: 'What is the acronym CDCFIB related to?', options: { A: 'Recruitment for NIS, NCS, FFS, and NSCDC', B: 'International Passport Control', C: 'Visa Processing', D: 'Border Demarcation' }, ans: 'A', exp: 'CDCFIB (Civil Defence, Correctional, Fire, and Immigration Services Board) oversees these four agencies.' },
    { id: 'I9', subject: 'IMMIGRATION_NIS', q: 'Which permit does NIS issue to non-Nigerians to reside and work?', options: { A: 'Visitor’s Permit', B: 'CERPAC/Residence Permit', C: 'Transit Visa', D: 'ECOWAS Travel Certificate' }, ans: 'B', exp: 'The Combined Expatriate Residence Permit and Alien Card (CERPAC) is key.' },
    { id: 'I10', subject: 'IMMIGRATION_NIS', q: 'An ECOWAS citizen can enter Nigeria without a visa using what document?', options: { A: 'International Passport', B: 'National ID Card', C: 'ECOWAS Travel Certificate', D: 'Diplomatic Passport' }, ans: 'C', exp: 'The ECOWAS Travel Certificate is used for free movement within the sub-region.' },
    { id: 'I11', subject: 'IMMIGRATION_NIS', q: 'The NIS is responsible for controlling the entry and exit of **\\dots** into and out of Nigeria.', options: { A: 'Goods', B: 'Persons', C: 'Vehicles', D: 'Animals' }, ans: 'B', exp: 'The primary focus of Immigration is the movement of persons.' },
    { id: 'I12', subject: 'IMMIGRATION_NIS', q: 'What is the NIS official national emergency line (mock)?', options: { A: '112', B: '001', C: '447', D: '911' }, ans: 'A', exp: '112 is a common emergency line (using 112 as a mock answer for a paramilitary agency).' },
    { id: 'I13', subject: 'IMMIGRATION_NIS', q: 'A visa is granted to a foreigner to permit:', options: { A: 'Residency', B: 'Entry', C: 'Citizenship', D: 'Permanent Stay' }, ans: 'B', exp: 'A visa generally grants permission for entry, not permanent stay or citizenship.' },
    { id: 'I14', subject: 'IMMIGRATION_NIS', q: 'The core duty of border patrol officers is to prevent:', options: { A: 'Tax evasion', B: 'Smuggling', C: 'Illegal migration', D: 'Road accidents' }, ans: 'C', exp: 'Preventing illegal migration and border violations is the core duty.' },
    { id: 'I15', subject: 'IMMIGRATION_NIS', q: 'In NIS structure, which rank immediately follows Comptroller?', options: { A: 'Deputy Comptroller', B: 'Assistant Comptroller', C: 'Superintendent', D: 'Chief Inspector' }, ans: 'A', exp: 'The rank structure is: Comptroller General, Deputy Comptroller General, Assistant Comptroller General, etc.' },

    // CIVIL DEFENCE (NSCDC) - 15 Questions Pool
    { id: 'C1', subject: 'CIVIL_DEFENCE_NSCDC', q: 'Which Nigerian agency handles civil defense?', options: { A: 'CDCFIB', B: 'NSCDC', C: 'NDLEA', D: 'DSS' }, ans: 'B', exp: 'NSCDC (Nigeria Security and Civil Defence Corps) is the national civil defense agency.' },
    { id: 'C2', subject: 'CIVIL_DEFENCE_NSCDC', q: 'What is the motto of the NSCDC?', options: { A: 'Service and Integrity', B: 'Defending the Nation', C: 'Integrity and Service', D: 'Defense and Security' }, ans: 'C', exp: 'The NSCDC motto is "Integrity and Service".' },
    { id: 'C3', subject: 'CIVIL_DEFENCE_NSCDC', q: 'NSCDC primarily protects which of these infrastructures?', options: { A: 'Private Schools', B: 'Critical National Assets and Infrastructure', C: 'Motor Parks', D: 'Local Market Stalls' }, ans: 'B', exp: 'Protection of Critical National Assets and Infrastructure (CNAI) is a core mandate.' },
    { id: 'C4', subject: 'CIVIL_DEFENCE_NSCDC', q: 'The highest rank in the NSCDC is:', options: { A: 'Inspector General', B: 'Comptroller General', C: 'Commandant General', D: 'Director General' }, ans: 'C', exp: 'The Commandant General is the highest rank and head of the Corps.' },
    { id: 'C5', subject: 'CIVIL_DEFENCE_NSCDC', q: 'NSCDC is known for combating the vandalism of:', options: { A: 'Electric poles', B: 'Oil pipelines', C: 'Telecommunication masts', D: 'All of the above' }, ans: 'D', exp: 'Its CNAI mandate covers all these critical infrastructures, especially pipelines.' },
    { id: 'C6', subject: 'CIVIL_DEFENCE_NSCDC', q: 'In disaster management, the NSCDC often collaborates with:', options: { A: 'Customs', B: 'NEMA', C: 'FRSC', D: 'NAPTIP' }, ans: 'B', exp: 'NEMA (National Emergency Management Agency) is the primary partner for disaster response.' },
    { id: 'C7', subject: 'CIVIL_DEFENCE_NSCDC', q: 'The NSCDC Act gives the Corps powers to regulate:', options: { A: 'Motorcycles', B: 'Private Guard Companies (PGCs)', C: 'Oil Refineries', D: 'Local Markets' }, ans: 'B', exp: 'The regulation and licensing of Private Guard Companies is a specific NSCDC function.' },
    { id: 'C8', subject: 'CIVIL_DEFENCE_NSCDC', q: 'NSCDC was upgraded to a paramilitary status by an Act of Parliament in:', options: { A: '1988', B: '2003', C: '1999', D: '1970' }, ans: 'B', exp: 'The current status and expanded functions were formalized by the Act of 2003.' },
    { id: 'C9', subject: 'CIVIL_DEFENCE_NSCDC', q: 'The colour of the NSCDC beret is:', options: { A: 'Blue', B: 'Red', C: 'Green', D: 'Orange' }, ans: 'C', exp: 'The NSCDC beret is green.' },
    { id: 'C10', subject: 'CIVIL_DEFENCE_NSCDC', q: 'Which Ministry supervises the NSCDC?', options: { A: 'Defence', B: 'Interior', C: 'Police Affairs', D: 'Justice' }, ans: 'B', exp: 'The NSCDC is one of the agencies under the Ministry of Interior.' },
    { id: 'C11', subject: 'CIVIL_DEFENCE_NSCDC', q: 'The primary function of the NSCDC is to maintain:', options: { A: 'Law and Order', B: 'Internal Security', C: 'Public Safety and Civil Protection', D: 'Border Security' }, ans: 'C', exp: 'The Corps focuses on public safety and civil protection, distinct from the Police’s primary law and order mandate.' },
    { id: 'C12', subject: 'CIVIL_DEFENCE_NSCDC', q: 'The NSCDC Act of 2007 allows the Corps to carry:', options: { A: 'Drones', B: 'Light arms', C: 'Heavy artillery', D: 'Only batons' }, ans: 'B', exp: 'The Act permits the use of light arms by NSCDC personnel.' },
    { id: 'C13', subject: 'CIVIL_DEFENCE_NSCDC', q: 'NSCDC intervention in communal conflicts is aimed at:', options: { A: 'Arresting all parties', B: 'Neutralizing one party', C: 'Disaster mitigation and mediation', D: 'Taking control of land' }, ans: 'C', exp: 'The NSCDC often acts as a mediator and ensures safety during conflicts and disasters.' },
    { id: 'C14', subject: 'CIVIL_DEFENCE_NSCDC', q: 'The NSCDC personnel structure is characterized as:', options: { A: 'Strictly military', B: 'Civilian and military', C: 'Paramilitary', D: 'Strictly civilian' }, ans: 'C', exp: 'The Corps is paramilitary in structure.' },
    { id: 'C15', subject: 'CIVIL_DEFENCE_NSCDC', q: 'Which department of NSCDC deals with intelligence gathering?', options: { A: 'Operations', B: 'Administration', C: 'Intelligence and Investigation', D: 'Logistics' }, ans: 'C', exp: 'The Intelligence and Investigation Directorate handles intelligence and criminal cases.' },

    // CORRECTIONAL CENTER (NCS) - 15 Questions Pool
    { id: 'N1', subject: 'CORRECTIONAL_NCS', q: 'The acronym NCS stands for:', options: { A: 'Nigerian Central Security', B: 'Nigerian Correctional Service', C: 'National Custom Service', D: 'Nigerian Council of States' }, ans: 'B', exp: 'NCS stands for Nigerian Correctional Service, replacing the former NPS.' },
    { id: 'N2', subject: 'CORRECTIONAL_NCS', q: 'The key focus of the NCS, following the 2019 Act, shifted to:', options: { A: 'Punishment and deterrence', B: 'Reformation and Rehabilitation', C: 'Long-term detention only', D: 'Generating revenue' }, ans: 'B', exp: 'The 2019 Act emphasizes rehabilitation and social reintegration of offenders.' },
    { id: 'N3', subject: 'CORRECTIONAL_NCS', q: 'The head of the Nigerian Correctional Service is the:', options: { A: 'Inspector General of Prisons', B: 'Comptroller General of Corrections', C: 'Chief Judge', D: 'Commandant General' }, ans: 'B', exp: 'The head of the NCS is the Comptroller General of Corrections.' },
    { id: 'N4', subject: 'CORRECTIONAL_NCS', q: 'The NCS was formerly known as:', options: { A: 'Nigerian Prison Service (NPS)', B: 'Federal Prisons Agency (FPA)', C: 'National Inmates Service (NIS)', D: 'Nigerian Detention Center (NDC)' }, ans: 'A', exp: 'The Nigerian Prisons Service (NPS) was renamed to NCS in 2019.' },
    { id: 'N5', subject: 'CORRECTIONAL_NCS', q: 'The NCS Act 2019 established a non-custodial service which includes:', options: { A: 'Life imprisonment', B: 'Parole and community service', C: 'Hard labor', D: 'Military detention' }, ans: 'B', exp: 'Non-custodial measures like parole, probation, and community service are key components of the new Act.' },
    { id: 'N6', subject: 'CORRECTIONAL_NCS', q: 'What is the purpose of the Borstal Institutions managed by NCS?', options: { A: 'For female offenders', B: 'For elderly offenders', C: 'For juvenile offenders', D: 'For high-risk inmates' }, ans: 'C', exp: 'Borstal Institutions are specialized reformatory centers for young/juvenile offenders.' },
    { id: 'N7', subject: 'CORRECTIONAL_NCS', q: 'The primary role of NCS staff is the custody of persons committed to custody by:', options: { A: 'Their families', B: 'The law/courts', C: 'The military', D: 'Local government' }, ans: 'B', exp: 'The Service holds persons committed to custody by the courts via warrants.' },
    { id: 'N8', subject: 'CORRECTIONAL_NCS', q: 'The NCS uniform color is primarily:', options: { A: 'Red and Black', B: 'Blue and Black', C: 'Green and Khaki', D: 'White and Blue' }, ans: 'B', exp: 'NCS uniforms typically feature blue and black colors.' },
    { id: 'N9', subject: 'CORRECTIONAL_NCS', q: 'Which section of the NCS handles medical care for inmates?', options: { A: 'Operations Directorate', B: 'Health and Welfare Directorate', C: 'Technical Directorate', D: 'Legal Directorate' }, ans: 'B', exp: 'The Health and Welfare Directorate manages medical services and inmate well-being.' },
    { id: 'N10', subject: 'CORRECTIONAL_NCS', q: 'What key term is used to describe the process of preparing an offender to return to society?', options: { A: 'Detention', B: 'Recidivism', C: 'Reintegration', D: 'Correction' }, ans: 'C', exp: 'Social reintegration is the critical final phase of correction.' },
    { id: 'N11', subject: 'CORRECTIONAL_NCS', q: 'The NCS is primarily under the supervision of the Ministry of:', options: { A: 'Justice', B: 'Interior', C: 'Police Affairs', D: 'Defence' }, ans: 'B', exp: 'The NCS is under the Federal Ministry of Interior.' },
    { id: 'N12', subject: 'CORRECTIONAL_NCS', q: 'Which of these is NOT an aim of the 2019 NCS Act?', options: { A: 'Reformation', B: 'Rehabilitation', C: 'Punitive Isolation', D: 'Reintegration' }, ans: 'C', exp: 'The Act shifted away from purely punitive isolation towards reformation.' },
    { id: 'N13', subject: 'CORRECTIONAL_NCS', q: 'What body provides statutory oversight for the NCS?', options: { A: 'FRSC', B: 'CDCFIB', C: 'NEMA', D: 'DSS' }, ans: 'B', exp: 'CDCFIB (Civil Defence, Correctional, Fire, and Immigration Services Board) provides oversight.' },
    { id: 'N14', subject: 'CORRECTIONAL_NCS', q: 'The term **parole** in the Correctional system means:', options: { A: 'Permanent release', B: 'Temporary release under supervision', C: 'Life imprisonment', D: 'Hard labor sentencing' }, ans: 'B', exp: 'Parole is the conditional release of a prisoner before the completion of the sentence.' },
    { id: 'N15', subject: 'CORRECTIONAL_NCS', q: 'The maximum security prison in Nigeria is often considered to be located in:', options: { A: 'Lagos', B: 'Kirikiri', C: 'Kano', D: 'Calabar' }, ans: 'B', exp: 'Kirikiri Maximum Security Prison is the most commonly known facility.' },

    // FEDERAL FIRE SERVICE (FFS) - 15 Questions Pool
    { id: 'F1', subject: 'FIRE_FFS', q: 'What is the core function of the Federal Fire Service (FFS)?', options: { A: 'Border control', B: 'Fire fighting and prevention', C: 'Pipeline protection', D: 'Road traffic control' }, ans: 'B', exp: 'The FFS is primarily responsible for fighting and preventing fires.' },
    { id: 'F2', subject: 'FIRE_FFS', q: 'The FFS is headed by the:', options: { A: 'Fire Marshal', B: 'Controller General of Fire', C: 'Commandant General', D: 'Inspector General' }, ans: 'B', exp: 'The FFS is headed by the Controller General of the Federal Fire Service.' },
    { id: 'F3', subject: 'FIRE_FFS', q: 'The FFS motto is:', options: { A: 'Safety First', B: 'Service and Safety', C: 'Protection of Lives and Property', D: 'Fire is the Enemy' }, ans: 'C', exp: 'The official FFS motto is "Protection of Lives and Property".' },
    { id: 'F4', subject: 'FIRE_FFS', q: 'What class of fire involves flammable liquids (e.g., petrol, kerosene)?', options: { A: 'Class A', B: 'Class B', C: 'Class C', D: 'Class D' }, ans: 'B', exp: 'Class B fires involve flammable liquids and gases.' },
    { id: 'F5', subject: 'FIRE_FFS', q: 'The FFS helps in certifying a building’s:', options: { A: 'Structure stability', B: 'Fire Safety Compliance', C: 'Electrical wiring', D: 'Plumbing standards' }, ans: 'B', exp: 'Issuing Fire Safety Certificates is a major regulatory role of the FFS.' },
    { id: 'F6', subject: 'FIRE_FFS', q: 'Which firefighting agent is primarily used by FFS for electrical fires?', options: { A: 'Water', B: 'Foam', C: 'CO2 or Dry Chemical', D: 'Sand' }, ans: 'C', exp: 'CO2 or Dry Chemical extinguishers are used for Class C (electrical) fires as they are non-conductive.' },
    { id: 'F7', subject: 'FIRE_FFS', q: 'In fire safety, what is a crucial preventative measure?', options: { A: 'Water rationing', B: 'Installation of smoke detectors', C: 'Daily sweeping', D: 'High voltage use' }, ans: 'B', exp: 'Smoke detectors provide early warning, which is critical for fire prevention.' },
    { id: 'F8', subject: 'FIRE_FFS', q: 'FFS often participates in Search and Rescue operations, collaborating with:', options: { A: 'Nigerian Navy', B: 'NEMA and NSCDC', C: 'Central Bank', D: 'Judiciary' }, ans: 'B', exp: 'FFS provides specialized rescue services alongside NEMA and NSCDC during emergencies.' },
    { id: 'F9', subject: 'FIRE_FFS', q: 'What color is typically associated with fire trucks in Nigeria?', options: { A: 'Blue', B: 'Green', C: 'Red', D: 'Yellow' }, ans: 'C', exp: 'Red is the universal color for emergency vehicles like fire trucks.' },
    { id: 'F10', subject: 'FIRE_FFS', q: 'The FFS is a department under the Ministry of:', options: { A: 'Defence', B: 'Environment', C: 'Interior', D: 'Works' }, ans: 'C', exp: 'Like NSCDC, NIS, and NCS, the FFS is under the Federal Ministry of Interior.' },
    { id: 'F11', subject: 'FIRE_FFS', q: 'Class A fires involve which type of materials?', options: { A: 'Flammable Liquids', B: 'Metals', C: 'Ordinary Combustibles (wood, paper, cloth)', D: 'Electrical Equipment' }, ans: 'C', exp: 'Class A fires involve common materials like wood, paper, and cloth.' },
    { id: 'F12', subject: 'FIRE_FFS', q: 'The technique of cooling a burning substance below its ignition temperature using water is called:', options: { A: 'Starvation', B: 'Smothering', C: 'Cooling', D: 'Dilution' }, ans: 'C', exp: 'Cooling is the primary method of using water to put out fires.' },
    { id: 'F13', subject: 'FIRE_FFS', q: 'The removal of fuel from a fire is known as:', options: { A: 'Cooling', B: 'Smothering', C: 'Starvation', D: 'Separation' }, ans: 'C', exp: 'Starvation is the process of removing the fuel source to break the fire triangle.' },
    { id: 'F14', subject: 'FIRE_FFS', q: 'The FFS is also mandated to provide:', options: { A: 'Ambulance services during accidents', B: 'Security escort for high-profile figures', C: 'Training on fire prevention', D: 'Border checkpoint management' }, ans: 'C', exp: 'Providing training and education on fire prevention is a core FFS mandate.' },
    { id: 'F15', subject: 'FIRE_FFS', q: 'Which fire extinguisher type is identified by a **RED** label or body?', options: { A: 'Water', B: 'Foam', C: 'Dry Powder', D: 'CO2' }, ans: 'A', exp: 'While modern standards use color coding on bands, historically and commonly, water extinguishers were often plain red.' },

// --- ADDED FROM CDCFIB PRACTICE QUESTIONS (Batch 1) ---

// FIRE SERVICE (additional from PDF)
    { id: 'F16', subject: 'FIRE_FFS', q: 'What is the main component of dry chemical powder extinguishers?', options: { A: 'Monoammonium phosphate', B: 'Sodium bicarbonate', C: 'Potassium chloride', D: 'Calcium carbonate' }, ans: 'A', exp: 'Dry chemical powders commonly use monoammonium phosphate as the extinguishing agent.' },
    { id: 'F17', subject: 'FIRE_FFS', q: 'H2O is?', options: { A: 'Water', B: 'Hydrogen peroxide', C: 'Hydroxide', D: 'Hydrogen oxide' }, ans: 'A', exp: 'H2O is the chemical formula for water.' },
    { id: 'F18', subject: 'FIRE_FFS', q: 'Which gas is primarily used in human respiration?', options: { A: 'Oxygen', B: 'Carbon dioxide', C: 'Nitrogen', D: 'Helium' }, ans: 'A', exp: 'Oxygen is the gas humans inhale for respiration.' },
    { id: 'F19', subject: 'FIRE_FFS', q: 'When was the Federal Fire Service (as a unit under Lagos Police Fire Brigade) first started?', options: { A: '1901', B: '1910', C: '1920', D: '1950' }, ans: 'A', exp: 'The service traces its origins to 1901 as part of the Lagos Police Fire Brigade.' },
    { id: 'F20', subject: 'FIRE_FFS', q: 'Class A fires involve which type of materials?', options: { A: 'Ordinary combustibles (wood, paper, cloth)', B: 'Flammable liquids', C: 'Electrical equipment', D: 'Metals' }, ans: 'A', exp: 'Class A fires are ordinary combustible materials such as wood, paper and cloth.' },
    { id: 'F21', subject: 'FIRE_FFS', q: 'Class B fires involve which type of materials?', options: { A: 'Flammable liquids', B: 'Metals', C: 'Paper and wood', D: 'Electrical equipment' }, ans: 'A', exp: 'Class B fires involve flammable liquids.' },
    { id: 'F22', subject: 'FIRE_FFS', q: 'Class C fires involve which type of materials?', options: { A: 'Flammable gases', B: 'Flammable liquids', C: 'Metals', D: 'Paper' }, ans: 'A', exp: 'Class C fires are associated with flammable gases.' },
    { id: 'F23', subject: 'FIRE_FFS', q: 'Class D fires involve which type of materials?', options: { A: 'Combustible metals', B: 'Paper and cloth', C: 'Flammable liquids', D: 'Electrical appliances' }, ans: 'A', exp: 'Class D fires involve combustible metals such as magnesium.' },
    { id: 'F24', subject: 'FIRE_FFS', q: 'What is the emergency phone number for fire in Nigeria (as given in the PDF)?', options: { A: '112', B: '911', C: '999', D: '119' }, ans: 'A', exp: '112 is listed in the practice module as an emergency number for fire.' },

// NSCDC (Nigeria Security and Civil Defence Corps) - appended from PDF
    { id: 'C16', subject: 'CIVIL_DEFENCE_NSCDC', q: 'The Nigeria Security and Civil Defence Corps was first introduced in which year?', options: { A: 'May 1979', B: 'June 1979', C: 'May 1967', D: 'June 1967' }, ans: 'C', exp: 'The practice module indicates May 1967 as the year of introduction.' },
    { id: 'C17', subject: 'CIVIL_DEFENCE_NSCDC', q: 'What inspired the introduction of the NSCDC?', options: { A: 'The Lagos Market Women Protest', B: 'The Nigeria Civil War', C: 'The Aba Market Women Riot', D: 'Civil Unrest across the Country' }, ans: 'B', exp: 'The Nigeria Civil War was cited as the inspiration for the initial formation.' },
    { id: 'C18', subject: 'CIVIL_DEFENCE_NSCDC', q: 'During the Nigeria Civil War, the NSCDC was known as which of the following?', options: { A: 'Lagos Civil Security Commission', B: 'Lagos Security and Community Defense Corps', C: 'Lagos Civil Defense Committee', D: 'Lagos Security and Defense Corporation' }, ans: 'C', exp: 'It was known as the Lagos Civil Defense Committee during that period.' },
    { id: 'C19', subject: 'CIVIL_DEFENCE_NSCDC', q: 'What was the NSCDC’s initial core objective(s)?', options: { A: 'To sensitize and protect the Civil Populace', B: 'To maintain law and order in Civil Society', C: 'To foster movement of people', D: 'To encourage civil society to be peaceful' }, ans: 'A', exp: 'The initial aim was to sensitize and protect the civil populace.' },
    { id: 'C20', subject: 'CIVIL_DEFENCE_NSCDC', q: 'In what year did the former Lagos Civil Defense Committee become officially known as the NSCDC?', options: { A: '1980', B: '1970', C: '1960', D: '1990' }, ans: 'B', exp: 'The module lists 1970 as the year it became officially known as NSCDC.' },
    { id: 'C21', subject: 'CIVIL_DEFENCE_NSCDC', q: 'In what year did NSCDC become a National Security Outfit?', options: { A: '1984', B: '1988', C: '1994', D: '1986' }, ans: 'B', exp: '1988 is given as the year it became a national security outfit.' },
    { id: 'C22', subject: 'CIVIL_DEFENCE_NSCDC', q: 'Who is the Commandant General of NSCDC (as listed)?', options: { A: 'Prof. Attairu Jega', B: 'Dr. Ahmed Abubakar Audi', C: 'Engr. Ali Baba', D: 'Dr. Aliu Maina' }, ans: 'B', exp: 'Dr. Ahmed Abubakar Audi is listed in the practice module.' },
    { id: 'C23', subject: 'CIVIL_DEFENCE_NSCDC', q: 'What is the full meaning of NSCDC?', options: { A: 'Niger Security and Civil Defence Corps', B: 'Nigeria Security and Civil Defense Core', C: 'Nigeria Security and Civil Defence Corps', D: 'Nigeria Civil Defence Organization' }, ans: 'C', exp: 'NSCDC stands for Nigeria Security and Civil Defence Corps.' },
    { id: 'C24', subject: 'CIVIL_DEFENCE_NSCDC', q: 'How many Directorates does NSCDC have?', options: { A: '9', B: '8', C: '7', D: '6' }, ans: 'D', exp: 'The practice questions indicate 6 directorates.' },
    { id: 'C25', subject: 'CIVIL_DEFENCE_NSCDC', q: 'What is the legal document guiding the operations of NSCDC called?', options: { A: 'NSCDC Agenda', B: 'NSCDC Act', C: 'NSCDC Principles', D: 'NSCDC Laws' }, ans: 'B', exp: 'The NSCDC Act is the legal framework guiding the Corps.' },

// NCoS (Correctional Service) - additional entries from PDF
    { id: 'N16', subject: 'CORRECTIONAL_NCS', q: 'What is solitary confinement?', options: { A: 'Keeping an inmate alone in a cell as punishment', B: 'Group rehabilitation program', C: 'Temporary leave from prison', D: 'Open custody arrangement' }, ans: 'A', exp: 'Solitary confinement is the practice of isolating an inmate in a cell.' },
    { id: 'N17', subject: 'CORRECTIONAL_NCS', q: 'Choose the odd one out: (a) Rehabilitation (b) Imprisonment (c) Reformation (d) Endocrine', options: { A: 'Rehabilitation', B: 'Imprisonment', C: 'Reformation', D: 'Endocrine' }, ans: 'D', exp: 'Endocrine is unrelated to correctional service functions.' },
    { id: 'N18', subject: 'CORRECTIONAL_NCS', q: 'Choose the odd one out: (a) Court (b) Prison (c) Teacher (d) Police', options: { A: 'Court', B: 'Prison', C: 'Teacher', D: 'Police' }, ans: 'C', exp: 'Teacher is the odd one out – others are part of the criminal justice system.' },
    { id: 'N19', subject: 'CORRECTIONAL_NCS', q: 'What does NCoS stand for?', options: { A: 'Nigerian Correctional Service', B: 'National Correctional Society', C: 'Nigerian Correctional System', D: 'National Corrections Service' }, ans: 'A', exp: 'NCoS stands for Nigerian Correctional Service.' },
    { id: 'N20', subject: 'CORRECTIONAL_NCS', q: 'Which is the correct title for the head of NCoS?', options: { A: 'Comptroller General', B: 'Controller General', C: 'Commandant General', D: 'Major General' }, ans: 'B', exp: 'The correct title is Controller General.' },

// NIS (Immigration Service) - appended from PDF
    { id: 'I16', subject: 'IMMIGRATION_NIS', q: 'Which of the following is a core duty of the Nigeria Immigration Service (NIS)?', options: { A: 'Persecuting offenders', B: 'Enforcing of laws', C: 'Issuance of all Nigerian travel documents', D: 'Deporting of foreigners' }, ans: 'C', exp: 'Issuance of travel documents (passports) is a core duty of NIS.' },
    { id: 'I17', subject: 'IMMIGRATION_NIS', q: 'The NIS was separated from the Nigerian Police Force in which year?', options: { A: '1946', B: '1956', C: '1958', D: '1964' }, ans: 'C', exp: 'The module lists 1958 as the year NIS was brought out of the police.' },
    { id: 'I18', subject: 'IMMIGRATION_NIS', q: 'The NIS was formally established by an Act of Parliament in which year?', options: { A: '1963', B: '1957', C: '1964', D: '1976' }, ans: 'A', exp: '1963 is listed as the formal establishment year by Act of Parliament.' },
    { id: 'I19', subject: 'IMMIGRATION_NIS', q: 'Which was the first African country to introduce an e-passport (as listed)?', options: { A: 'South Africa', B: 'Ghana', C: 'Liberia', D: 'Nigeria' }, ans: 'D', exp: 'Nigeria is listed in the practice module as the first African country to introduce e-passport.' },
    { id: 'I20', subject: 'IMMIGRATION_NIS', q: 'How many Comptroller Generals has NIS had (as given)?', options: { A: '10', B: '12', C: '8', D: '15' }, ans: 'A', exp: 'The module lists 10 Comptroller Generals since inception.' },
    { id: 'I21', subject: 'IMMIGRATION_NIS', q: 'Who is listed as the present Comptroller General of NIS in the PDF?', options: { A: 'Umar Dahiru', B: 'David Parradang', C: 'Boniface Cosmos', D: 'Kemi Nandap' }, ans: 'D', exp: 'Kemi Nandap is listed as the present Comptroller General in the sample.' },
    { id: 'I22', subject: 'IMMIGRATION_NIS', q: 'Which title is correct for the head of NIS?', options: { A: 'Comptroller General', B: 'Controller General', C: 'Commandant General', D: 'Major General' }, ans: 'A', exp: 'The head of NIS holds the title Comptroller General.' },
    { id: 'I23', subject: 'IMMIGRATION_NIS', q: 'How many Directorates does NIS have (as listed)?', options: { A: '10', B: '8', C: '7', D: '9' }, ans: 'A', exp: 'The module indicates 10 directorates.' },
    { id: 'I24', subject: 'IMMIGRATION_NIS', q: 'What does CGIS stand for?', options: { A: 'Comptroller General of Immigration Service', B: 'Central Government Immigration Service', C: 'Comprehensive Government Immigration System', D: 'Complainant General Immigration Service' }, ans: 'A', exp: 'CGIS is an abbreviation for Comptroller General of Immigration Service.' },
    { id: 'I25', subject: 'IMMIGRATION_NIS', q: 'NIS is under which Ministry?', options: { A: 'Ministry of Defence', B: 'Ministry of Foreign Affairs', C: 'Ministry of Interior', D: 'Ministry of Justice' }, ans: 'C', exp: 'NIS operates under the Ministry of Interior.' },

// CURRENT AFFAIRS -> map into GENERAL subject (append as G21..)
    { id: 'G101', subject: 'GENERAL', q: 'The first Secretary General of the Commonwealth was?', options: { A: 'George Washington', B: 'Tulam Goldie', C: 'Arnold Smith', D: 'Joseph Garba' }, ans: 'C', exp: 'Arnold Smith was the first Secretary General of the Commonwealth.' },
    { id: 'G102', subject: 'GENERAL', q: 'Lagos became a crown colony in which year?', options: { A: '1862', B: '1861', C: '1841', D: '1886' }, ans: 'A', exp: '1862 is listed as the year Lagos became a crown colony.' },
    { id: 'G103', subject: 'GENERAL', q: 'World War I took place between which years?', options: { A: '1911-1914', B: '1914-1916', C: '1916-1918', D: '1914-1918' }, ans: 'D', exp: 'World War I occurred between 1914 and 1918.' },
    { id: 'G104', subject: 'GENERAL', q: 'The Western and Eastern regions of Nigeria became self-governing in which year?', options: { A: '1959', B: '1960', C: '1957', D: '1956' }, ans: 'C', exp: 'The module lists 1957 for regional self-government.' },
    { id: 'G105', subject: 'GENERAL', q: 'Who was the first head of government of Nigeria?', options: { A: 'Yakubu Gowon', B: 'Aguiyi Ironsi', C: 'Tafawa Balewa', D: 'Nnamdi Azikiwe' }, ans: 'C', exp: 'Tafawa Balewa was the first Prime Minister (head of government).' },
    { id: 'G106', subject: 'GENERAL', q: 'Who was the first military president of Nigeria?', options: { A: 'Sanni Abacha', B: 'Ibrahim Babangida', C: 'Aguiyi Ironsi', D: 'Yakubu Gowon' }, ans: 'C', exp: 'Aguiyi Ironsi is widely recognized as the first military Head of State.' },
    { id: 'G107', subject: 'GENERAL', q: 'Nigeria became a republic in which year?', options: { A: '1963', B: '1960', C: '1976', D: '1961' }, ans: 'A', exp: 'Nigeria became a republic in 1963.' },
    { id: 'G108', subject: 'GENERAL', q: 'The Northern and Southern protectorates were amalgamated in which year?', options: { A: '1914', B: '1919', C: '1921', D: '1900' }, ans: 'A', exp: 'The amalgamation occurred in 1914.' },
    { id: 'G109', subject: 'GENERAL', q: 'Who was the first Executive President?', options: { A: 'Nnamdi Azikiwe', B: 'Olusegun Obasanjo', C: 'Shehu Shagari', D: 'Goodluck Jonathan' }, ans: 'A', exp: 'Nnamdi Azikiwe served as Governor-General and later as President; listed as first Executive President in the module.' },
    { id: 'G110', subject: 'GENERAL', q: 'Who was the first colonial Governor-General of Nigeria?', options: { A: 'Tulam Goldie', B: 'James Robertson', C: 'Huge Clifford', D: 'Lord Lugard' }, ans: 'A', exp: 'Tulam (T. H.) Goldie is listed in the module.' },
    { id: 'G111', subject: 'GENERAL', q: 'Which is the highest court in Nigeria?', options: { A: 'Court of Appeal', B: 'Supreme Court', C: 'Federal High Court', D: 'Magistrate Court' }, ans: 'B', exp: 'The Supreme Court is the apex court in Nigeria.' },
    { id: 'G112', subject: 'GENERAL', q: 'ECOWAS was established in __ and has its administrative headquarters in __', options: { A: '1967, Lome', B: '1975, Lome', C: '1975, Lagos', D: '1967, Lagos' }, ans: 'B', exp: 'ECOWAS was established in 1975 with headquarters in Lome.' },
    { id: 'G113', subject: 'GENERAL', q: 'The first general election in Nigeria was held in which year?', options: { A: '1964', B: '1960', C: '1963', D: '1999' }, ans: 'A', exp: 'The module references 1964 as the first general election.' },
    { id: 'G114', subject: 'GENERAL', q: 'Nigeria practices which system of government?', options: { A: 'Confederalism', B: 'Unitarism', C: 'Parliamentarianism', D: 'Federalism' }, ans: 'D', exp: 'Nigeria practices a federal system of government.' },
    { id: 'G115', subject: 'GENERAL', q: 'Who was the last colonial Governor-General of Nigeria?', options: { A: 'James Robertson', B: 'Jimmy Carter', C: 'Lord Lugard', D: 'Huge Clifford' }, ans: 'A', exp: 'James Robertson is listed as the last colonial Governor-General.' },
    { id: 'G116', subject: 'GENERAL', q: 'The first military coup d’état in Nigeria was in which year?', options: { A: '1964', B: '1966', C: '1960', D: '1999' }, ans: 'B', exp: 'The first military coup took place in 1966.' },
    { id: 'G117', subject: 'GENERAL', q: 'The establishment of states in Nigeria started on which date?', options: { A: 'May 27, 1967', B: 'Feb 13, 1966', C: 'April 8, 1960', D: 'Oct 1, 1960' }, ans: 'A', exp: 'May 27, 1967 marked the beginning of state creation.' },
    { id: 'G118', subject: 'GENERAL', q: 'The Biafra Civil War took place between which years?', options: { A: '1967-1968', B: '1968-1971', C: '1967-1970', D: '1970-1975' }, ans: 'C', exp: 'The Biafra Civil War lasted from 1967 to 1970.' },
    { id: 'G119', subject: 'GENERAL', q: 'The National Youth Service Corps (NYSC) was established in which year?', options: { A: '1960', B: '1973', C: '1980', D: '1997' }, ans: 'B', exp: 'NYSC was established in 1973.' },
    { id: 'G120', subject: 'GENERAL', q: 'The Nigeria Police Force belongs to which organ of government?', options: { A: 'Judiciary', B: 'Executive', C: 'Legislative', D: 'None of the above' }, ans: 'B', exp: 'The police are part of the Executive arm of government.' },
    { id: 'G121', subject: 'GENERAL', q: 'Africa consists of how many countries (as given)?', options: { A: '54', B: '55', C: '60', D: '70' }, ans: 'A', exp: 'The module lists Africa as consisting of 54 countries.' },
    { id: 'G122', subject: 'GENERAL', q: 'The Secretary General of OPEC (as listed) is?', options: { A: 'Abdulsaleam Kanuri', B: 'Abdullah El-Badri', C: 'Utuhu Kamirideen', D: 'Haitham Al Ghais' }, ans: 'D', exp: 'Haitham Al Ghais is listed as the current Secretary General of OPEC.' },
    { id: 'G123', subject: 'GENERAL', q: 'The current Secretary General of the United Nations is?', options: { A: 'Ban Ki-moon', B: 'Antonio Guterres', C: 'Kofi Annan', D: 'Boutros Boutros-Ghali' }, ans: 'B', exp: 'Antonio Guterres is the current UN Secretary-General.' },
    { id: 'G124', subject: 'GENERAL', q: 'Which of the following pairs of countries are permanent members of the UN Security Council?', options: { A: 'Brazil, Germany, France, USA, China', B: 'France, China, USSR, USA, Britain', C: 'France, Germany, Japan, China, Britain', D: 'Brazil, New Zealand, Britain, France, China' }, ans: 'B', exp: 'France, China, USSR (now Russia), USA and Britain are the permanent members.' },
    { id: 'G125', subject: 'GENERAL', q: 'To qualify for the office of President in Nigeria, the candidate must be at least which age?', options: { A: '35 years', B: '20 years', C: '40 years', D: '55 years' }, ans: 'A', exp: 'The Constitution sets the minimum age at 35 years.' },
    { id: 'G126', subject: 'GENERAL', q: 'The name "Nigeria" was coined from which geographical feature?', options: { A: 'Niger Forest', B: 'Niger Area', C: 'Niger River', D: 'Niger Textures' }, ans: 'C', exp: 'The name Nigeria derives from the Niger River.' },
    { id: 'G127', subject: 'GENERAL', q: 'Who was the first Inspector General of Police in Nigeria?', options: { A: 'Teslim Balogun', B: 'Louis Edet', C: 'Ademola Adetokunbo', D: 'Elias Balogon' }, ans: 'B', exp: 'Louis Edet is historically recognized as the first IGP.' },
    { id: 'G128', subject: 'GENERAL', q: 'The current Secretary General / Commission Chairman of the African Union (as listed) is?', options: { A: 'Dlamini Zuma', B: 'Alassane Ouattara', C: 'Emeka Anyaoku', D: 'Moussa Faki Mahamat' }, ans: 'D', exp: 'Moussa Faki Mahamat is the current Chairperson of the African Union Commission.' },
    { id: 'G129', subject: 'GENERAL', q: 'The current President of the Commission / Secretary of ECOWAS (as listed) is?', options: { A: 'H. Desategn', B: 'Omar Touray', C: 'Alassane Ouattara', D: 'Ike Ekweremadu' }, ans: 'B', exp: 'Omar Touray is listed as ECOWAS Commission President.' },
    { id: 'G130', subject: 'GENERAL', q: 'The headquarters of the United Nations is in which city?', options: { A: 'New York', B: 'Washington', C: 'Geneva', D: 'Vienna' }, ans: 'A', exp: 'UN Headquarters is based in New York.' },
    { id: 'G51', subject: 'GENERAL', q: 'The United Nations Organization (UNO) was founded in San Francisco in which year?', options: { A: '1939', B: '1914', C: '1945', D: '1950' }, ans: 'C', exp: 'The UN was founded in 1945 in San Francisco.' },
    { id: 'G52', subject: 'GENERAL', q: 'The first military coup d’état in Africa occurred in which country (as listed)?', options: { A: 'Libya', B: 'Liberia', C: 'Egypt', D: 'Nigeria' }, ans: 'C', exp: 'The module lists Egypt as the first country in Africa with a military coup.' },
    { id: 'G53', subject: 'GENERAL', q: 'Nigeria became 36 states under the regime of which leader?', options: { A: 'Olusegun Obasanjo', B: 'Sanni Abacha', C: 'Ibrahim Babangida', D: 'Yakubu Gowon' }, ans: 'B', exp: 'The module lists Sanni Abacha for this change.' },
    { id: 'G54', subject: 'GENERAL', q: 'Who was the first military head of state in Nigeria?', options: { A: 'Yakubu Gowon', B: 'Aguiyi Ironsi', C: 'Olusegun Obasanjo', D: 'Ernest' }, ans: 'B', exp: 'Aguiyi Ironsi led the first military government after 1966 coup.' },
    { id: 'G55', subject: 'GENERAL', q: 'Oil can be found in all the following Nigerian states EXCEPT which one?', options: { A: 'Lagos', B: 'Anambra', C: 'Ondo', D: 'Ekiti' }, ans: 'D', exp: 'Ekiti is not listed among the main oil-producing states in the module.' },
    { id: 'G56', subject: 'GENERAL', q: 'Tin is majorly found in which Nigerian city?', options: { A: 'Jos', B: 'Enugu', C: 'Kano', D: 'Imo' }, ans: 'A', exp: 'Jos is historically known for tin mining.' },
    { id: 'G57', subject: 'GENERAL', q: 'Oil was first discovered by Shell-BP in Nigeria at which location?', options: { A: 'Oloibiri', B: 'Idanre', C: 'Warri', D: 'Kabba' }, ans: 'A', exp: 'Oloibiri is the historic site of Nigeria\'s first oil discovery.' },
    { id: 'G58', subject: 'GENERAL', q: 'Which of the following may be regarded as a regional organization?', options: { A: 'ECOWAS', B: 'OAU', C: 'UN', D: 'OPEC' }, ans: 'B', exp: 'OAU (now African Union) is a regional organization; ECOWAS is also regional but answer per module is OAU.' },
    { id: 'G59', subject: 'GENERAL', q: 'Who was the last military Head of State of Nigeria?', options: { A: 'Abdulsalami Abubakar', B: 'Yakubu Gowon', C: 'Sanni Abacha', D: 'Olusegun Obasanjo' }, ans: 'A', exp: 'Abdulsalami Abubakar was the last military head before transition to civilian rule.' },
    { id: 'G60', subject: 'GENERAL', q: 'Who coined the name "Nigeria" (as listed)?', options: { A: 'Flora Shaw', B: 'Mary Slessor', C: 'Lord Lugard', D: 'T. J. Goldie' }, ans: 'A', exp: 'Flora Shaw (later Lady Lugard) is credited with coining the name.' },
    { id: 'G61', subject: 'GENERAL', q: 'The legislature in Nigeria is called which of the following?', options: { A: 'House of Assembly', B: 'House of Representatives', C: 'House of Lords', D: 'National Assembly' }, ans: 'D', exp: 'The Nigerian legislature is the National Assembly.' },
    { id: 'G62', subject: 'GENERAL', q: 'The legislature in Britain is referred to as which?', options: { A: 'House of Commons', B: 'White House', C: 'Congress', D: 'Parliament' }, ans: 'D', exp: 'The British legislature is called Parliament.' },
    { id: 'G63', subject: 'GENERAL', q: 'Nigeria changed from pounds to Naira in which year?', options: { A: '1960', B: '1973', C: '1959', D: '1963' }, ans: 'B', exp: 'The currency was changed to the Naira in 1973.' },
    { id: 'G64', subject: 'GENERAL', q: 'Which Nigerian president died in office as listed and on which date (module)?', options: { A: 'Murtala Mohammed - Feb 13, 1976', B: 'Sanni Abacha - June 8, 1998', C: 'Umaru Yar\'Adua - May 5, 2010', D: 'Aguiyi Ironsi - July 29, 1966' }, ans: 'D', exp: 'Aguiyi Ironsi was assassinated on July 29, 1966; the module lists the option accordingly.' },
    { id: 'G65', subject: 'GENERAL', q: 'Which date did the late former president Muhammadu Buhari die (module listing)?', options: { A: 'May 29, 2025', B: 'July 13, 2025', C: 'July 29, 2025', D: 'June 12, 2025' }, ans: 'B', exp: 'The practice file lists July 13, 2025 for this item.' },
    { id: 'G66', subject: 'GENERAL', q: 'Who is listed as the current Senate President of Nigeria (in the module)?', options: { A: 'David Mark', B: 'Bukola Saraki', C: 'Godswill Akpabio', D: 'Adams Oshiomhole' }, ans: 'C', exp: 'The practice module lists Godswill Akpabio.' },
    { id: 'G67', subject: 'GENERAL', q: 'Who is listed as the current Honourable Minister of Interior (in the module)?', options: { A: 'Rauf Aregbesola', B: 'Olubunmi Tunji-Ojo', C: 'Nyesom Wike', D: 'Olufemi Alausa' }, ans: 'B', exp: 'Olubunmi Tunji-Ojo is listed in the material.' },
    { id: 'G68', subject: 'GENERAL', q: 'Who is listed as the current Governor of the Central Bank of Nigeria (in the module)?', options: { A: 'Olayemi Cardoso', B: 'Godwin Emefiele', C: 'Lamido Sanusi', D: 'Folashodun Olubunmi (Osborne)' }, ans: 'A', exp: 'Olayemi Cardoso is listed as the CBN Governor in the practice file.' },
    { id: 'G69', subject: 'GENERAL', q: 'The arm of government charged with the responsibility of making laws is?', options: { A: 'Judiciary', B: 'Legislative', C: 'Executive', D: 'Parliament' }, ans: 'B', exp: 'The Legislative arm is responsible for making laws.' },
    { id: 'G70', subject: 'GENERAL', q: 'The eagle in the coat of arms stands for which quality?', options: { A: 'Strength', B: 'EFCC', C: 'Pride', D: 'Hero' }, ans: 'A', exp: 'The eagle symbolizes strength in the coat of arms.' },
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
    
    const departmentSubject = selectedDepartment === 'GENERAL_ALL' ? 'GENERAL' : selectedDepartment;
    
    // All subjects that will be included in this specific exam.
    const currentExamSubjects = [...FIXED_SUBJECTS];
    if (departmentSubject !== 'GENERAL') {
        currentExamSubjects.push(departmentSubject);
    }

    // 1. Compile questions from FIXED subjects (MATHS, ENGLISH, GENERAL)
    FIXED_SUBJECTS.forEach(subject => {
        let subjectPool = fullQuestionsData.filter(q => q.subject === subject);
        subjectPool = shuffleArray(subjectPool);
        const count = QUESTIONS_PER_SUBJECT_MAP[subject];
        const selectedQuestions = subjectPool.slice(0, count);
        examQuestions.push(...selectedQuestions);
    });
    
    // 2. Compile questions from the DEPARTMENTAL subject
    const departmentalPool = fullQuestionsData.filter(q => q.subject === departmentSubject);
    const shuffledDepartmentalPool = shuffleArray(departmentalPool);
    const departmentalCount = QUESTIONS_PER_SUBJECT_MAP.DEPARTMENTAL;
    const selectedDepartmentalQuestions = shuffledDepartmentalPool.slice(0, departmentalCount);
    examQuestions.push(...selectedDepartmentalQuestions);
    
    // Final check to ensure we hit 50 questions
    if (examQuestions.length !== TOTAL_QUESTIONS_COUNT) {
        console.error(`Error in question selection. Expected ${TOTAL_QUESTIONS_COUNT}, got ${examQuestions.length}.`);
        // Fallback: If total count is wrong, just ensure all questions are available.
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
