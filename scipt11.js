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
// const confirmStartButton = document.getElementById('confirm-start-button');

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

    // IMMIGRATION SERVICE (NIS) - 15 Questions Pool ---- 
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
    'q': 'Which of these ranks is an officer rank in the NIS structure?',
    'options': { 'A': 'Immigration Assistant', 'B': 'Chief Immigration Assistant', 'C': 'Deputy Comptroller of Immigration', 'D': 'Inspector of Immigration' },
    'ans': 'C',
    'exp': 'Deputy Comptroller of Immigration is a senior officer rank, while the others are generally subordinate or inspectorate ranks.'
  },
  {
    'id': 'I6',
    'subject': 'IMMIGRATION_NIS',
    'q': 'What is the current motto of the Nigeria Immigration Service (NIS)?',
    'options': { 'A': 'Service to the Nation', 'B': 'Integrity and Border Security', 'C': 'Peace and Security', 'D': 'Safety First' },
    'ans': 'B',
    'exp': 'The current motto of the NIS is \'Integrity and Border Security\'.'
  },
  {
    'id': 'I7',
    'subject': 'IMMIGRATION_NIS',
    'q': 'Which document is the NIS responsible for issuing to Nigerians for international travel?',
    'options': { 'A': 'National ID Card', 'B': 'Drivers\' License', 'C': 'International Passport', 'D': 'Birth Certificate' },
    'ans': 'C',
    'exp': 'The NIS is solely responsible for the issuance of the Nigerian International Passport.'
  },
  {
    'id': 'I8',
    'subject': 'IMMIGRATION_NIS',
    'q': 'What is the highest rank in the Nigeria Immigration Service?',
    'options': { 'A': 'Assistant Comptroller General', 'B': 'Comptroller General of Immigration Service', 'C': 'Director General', 'D': 'Zonal Coordinator' },
    'ans': 'B',
    'exp': 'The highest rank and head of the NIS is the Comptroller General of Immigration Service (CGIS).'
  },
  {
    'id': 'I9',
    'subject': 'IMMIGRATION_NIS',
    'q': 'The e-Passport system was introduced by the NIS primarily to:',
    'options': { 'A': 'Reduce passport cost', 'B': 'Enhance security and prevent forgery', 'C': 'Increase waiting time', 'D': 'Simplify application process for illiterates' },
    'ans': 'B',
    'exp': 'The e-Passport was introduced globally to enhance security and prevent fraudulent activities like forgery and identity theft.'
  },
  {
    'id': 'I10',
    'subject': 'IMMIGRATION_NIS',
    'q': 'Which of the following falls under the regulatory functions of the NIS?',
    'options': { 'A': 'Issuing of marriage certificates', 'B': 'Controlling the entry, stay, and exit of migrants', 'C': 'Maintaining internal law and order', 'D': 'Managing correctional facilities' },
    'ans': 'B',
    'exp': 'Controlling migration is a core regulatory function of the Immigration Service.'
  },
  {
    'id': 'I11',
    'subject': 'IMMIGRATION_NIS',
    'q': 'What is the title of the officer in charge of an NIS State Command?',
    'options': { 'A': 'State Coordinator', 'B': 'Comptroller of Immigration', 'C': 'Commander of the State Command', 'D': 'State Commissioner' },
    'ans': 'B',
    'exp': 'The officer in charge of an NIS State Command is usually a Comptroller of Immigration.'
  },
  {
    'id': 'I12',
    'subject': 'IMMIGRATION_NIS',
    'q': 'NIS is responsible for issuing which type of document to foreigners seeking to reside or work in Nigeria?',
    'options': { 'A': 'Tourist Permit', 'B': 'ECOWAS Travel Certificate', 'C': 'CERPAC (Combined Expatriate Residence Permit and Alien Card)', 'D': 'Student Visa' },
    'ans': 'C',
    'exp': 'The NIS issues the CERPAC as a legal document permitting expatriates to reside and work in Nigeria.'
  },
  {
    'id': 'I13',
    'subject': 'IMMIGRATION_NIS',
    'q': 'Before 1958, the control of movement in and out of Nigeria was managed by:',
    'options': { 'A': 'The Police Force', 'B': 'The Customs Department', 'C': 'Ministry of Foreign Affairs', 'D': 'Ministry of Defence' },
    'ans': 'B',
    'exp': 'Prior to 1958, the Immigration Department was a segment of the Customs Department.'
  },
  {
    'id': 'I14',
    'subject': 'IMMIGRATION_NIS',
    'q': 'What does the acronym \'NIS\' stand for?',
    'options': { 'A': 'Nigerian Internal Security', 'B': 'National Information System', 'C': 'Nigeria Immigration Service', 'D': 'Nigerian Intelligence System' },
    'ans': 'C',
    'exp': 'NIS stands for Nigeria Immigration Service.'
  },
  {
    'id': 'I15',
    'subject': 'IMMIGRATION_NIS',
    'q': 'The primary training institution for NIS officers is the:',
    'options': { 'A': 'Nigeria Police Academy', 'B': 'NIS Training School, Kano/Oluwa', 'C': 'Armed Forces Command and Staff College', 'D': 'Civil Defence College' },
    'ans': 'B',
    'exp': 'The NIS has specific training institutions, notable ones being in Kano and Oluwa (Port Harcourt).'
  },
  {
    'id': 'I16',
    'subject': 'IMMIGRATION_NIS',
    'q': 'A key duty of the NIS at International Airports is:',
    'options': { 'A': 'Directing aircraft traffic', 'B': 'Clearing passengers through immigration checks', 'C': 'Selling flight tickets', 'D': 'Conducting security screening of cargo' },
    'ans': 'B',
    'exp': 'Clearing passengers is the primary role of the NIS at border control points like airports.'
  },
  {
    'id': 'I17',
    'subject': 'IMMIGRATION_NIS',
    'q': 'Which NIS rank is equivalent to a Police Constable or Military Private?',
    'options': { 'A': 'Immigration Officer I', 'B': 'Immigration Assistant III', 'C': 'Assistant Superintendent of Immigration', 'D': 'Chief Superintendent of Immigration' },
    'ans': 'B',
    'exp': 'Immigration Assistant III (IA III) is the entry-level rank for the Assistant Cadre.'
  },
  {
    'id': 'I18',
    'subject': 'IMMIGRATION_NIS',
    'q': 'The NIS plays a crucial role in curbing which transnational crime?',
    'options': { 'A': 'Cybercrime', 'B': 'Pipeline vandalism', 'C': 'Human Trafficking and Smuggling of Migrants', 'D': 'Terrorism in the North East only' },
    'ans': 'C',
    'exp': 'Border management and control are vital in combating transnational crimes like human trafficking and migrant smuggling.'
  },
  {
    'id': 'I19',
    'subject': 'IMMIGRATION_NIS',
    'q': 'The Immigration Act CAP I1 Laws of the Federation of Nigeria, 2004, has been repealed and replaced by the:',
    'options': { 'A': 'Immigration Act 2015', 'B': 'Border Control Act 2019', 'C': 'Customs Act 2020', 'D': 'NIS Establishment Act 2011' },
    'ans': 'A',
    'exp': 'The Immigration Act 2015 is the current principal legislation governing the NIS.'
  },
  {
    'id': 'I20',
    'subject': 'IMMIGRATION_NIS',
    'q': 'In the NIS logo, what do the green and white colours of the Nigerian flag represent?',
    'options': { 'A': 'Agriculture and Peace', 'B': 'Wealth and Power', 'C': 'Service and Integrity', 'D': 'Peace and Unity' },
    'ans': 'A',
    'exp': 'In the Nigerian flag context, green traditionally represents agriculture and white represents peace and unity.'
  },
  {
    'id': 'I21',
    'subject': 'IMMIGRATION_NIS',
    'q': 'Which rank insignia in the NIS typically involves the use of the Eagle and Star?',
    'options': { 'A': 'Immigration Assistant ranks', 'B': 'Superintendent ranks', 'C': 'Comptroller ranks', 'D': 'Inspector ranks' },
    'ans': 'B',
    'exp': 'Superintendent ranks (Assistant Superintendent, Deputy Superintendent, etc.) often use variations of the star and the eagle.'
  },
  {
    'id': 'I22',
    'subject': 'IMMIGRATION_NIS',
    'q': 'The NIS is part of the security agencies under the purview of which body for general security coordination?',
    'options': { 'A': 'Economic and Financial Crimes Commission (EFCC)', 'B': 'National Security Adviser (NSA) Office', 'C': 'Federal Road Safety Corps (FRSC)', 'D': 'Nigerian Ports Authority (NPA)' },
    'ans': 'B',
    'exp': 'Security agencies coordinate under the umbrella of the Office of the National Security Adviser (ONSA).'
  },
  {
    'id': 'I23',
    'subject': 'IMMIGRATION_NIS',
    'q': 'How many geographical zones does the NIS typically use for operational structure?',
    'options': { 'A': '3', 'B': '6', 'C': '8', 'D': '12' },
    'ans': 'C',
    'exp': 'The NIS generally uses 8 zonal commands for effective operational coverage across the country.'
  },
  {
    'id': 'I24',
    'subject': 'IMMIGRATION_NIS',
    'q': 'The official uniform colour of the Nigeria Immigration Service is primarily:',
    'options': { 'A': 'Blue', 'B': 'Khaki', 'C': 'Black', 'D': 'Light Green' },
    'ans': 'B',
    'exp': 'The NIS uniform is a distinctive khaki colour.'
  },
  {
    'id': 'I25',
    'subject': 'IMMIGRATION_NIS',
    'q': 'Which section of the NIS is responsible for surveillance and patrol of the nation\'s land borders?',
    'options': { 'A': 'Passport Control Section', 'B': 'Border Patrol/ECOWAS Section', 'C': 'Visa Section', 'D': 'Expatriate Quota Section' },
    'ans': 'B',
    'exp': 'The Border Patrol/ECOWAS Section is specifically tasked with monitoring and policing the borders.'
  },
  {
    'id': 'I26',
    'subject': 'IMMIGRATION_NIS',
    'q': 'A key responsibility of the NIS is the issuance of residence permits to:',
    'options': { 'A': 'All citizens of ECOWAS member states', 'B': 'Non-Nigerians (Aliens)', 'C': 'Nigerian students abroad', 'D': 'Military personnel' },
    'ans': 'B',
    'exp': 'The NIS controls the stay of non-Nigerians in the country through permits.'
  },
  {
    'id': 'I27',
    'subject': 'IMMIGRATION_NIS',
    'q': 'When did the Immigration Department attain its full autonomy and become known as the Nigeria Immigration Service?',
    'options': { 'A': '1960', 'B': '1963', 'C': '1980', 'D': '1999' },
    'ans': 'B',
    'exp': 'It attained full autonomy with the Immigration Act of 1963.'
  },
  {
    'id': 'I28',
    'subject': 'IMMIGRATION_NIS',
    'q': 'Which category of personnel are responsible for the day-to-day enforcement duties at entry points?',
    'options': { 'A': 'Finance Officers', 'B': 'Immigration Operatives', 'C': 'Admin Staff', 'D': 'Procurement Officers' },
    'ans': 'B',
    'exp': 'Immigration Operatives are the frontline personnel responsible for enforcement duties.'
  },
  {
    'id': 'I29',
    'subject': 'IMMIGRATION_NIS',
    'q': 'What is the primary role of the NIS Special Task Force?',
    'options': { 'A': 'Managing staff welfare', 'B': 'Combating internal industrial crises', 'C': 'Special operations, raid duties, and internal security support', 'D': 'Overseeing training institutions' },
    'ans': 'C',
    'exp': 'The Special Task Force is usually deployed for sensitive, high-risk, or specific enforcement and security operations.'
  },
  {
    'id': 'I30',
    'subject': 'IMMIGRATION_NIS',
    'q': 'The NIS works closely with which international body concerning migration and border management?',
    'options': { 'A': 'World Health Organization (WHO)', 'B': 'International Organization for Migration (IOM)', 'C': 'United Nations Educational, Scientific and Cultural Organization (UNESCO)', 'D': 'International Maritime Organization (IMO)' },
    'ans': 'B',
    'exp': 'The IOM is the UN agency dedicated to promoting humane and orderly migration, making it a key partner for the NIS.'
  },
  {
    'id': 'I31',
    'subject': 'IMMIGRATION_NIS',
    'q': 'Which officer rank in the NIS is symbolized by a single star (pip) on the shoulder?',
    'options': { 'A': 'Comptroller of Immigration', 'B': 'Chief Superintendent of Immigration', 'C': 'Assistant Superintendent of Immigration II (ASI II)', 'D': 'Deputy Comptroller of Immigration' },
    'ans': 'C',
    'exp': 'Assistant Superintendent of Immigration II (ASI II) is typically an entry-level officer rank marked by one star.'
  },
  {
    'id': 'I32',
    'subject': 'IMMIGRATION_NIS',
    'q': 'An expatriate quota is issued to a company by the NIS to permit the company to:',
    'options': { 'A': 'Import goods duty-free', 'B': 'Employ a specified number of expatriate workers', 'C': 'Pay lower corporate taxes', 'D': 'Open branches in all Nigerian states' },
    'ans': 'B',
    'exp': 'The expatriate quota determines the number of foreign employees a company can legally hire in Nigeria.'
  },
  {
    'id': 'I33',
    'subject': 'IMMIGRATION_NIS',
    'q': 'The primary objective of the NIS Border Management Strategy is:',
    'options': { 'A': 'To increase revenue from visas', 'B': 'To ensure effective and efficient border surveillance and control', 'C': 'To recruit more staff', 'D': 'To manage traffic congestion at border crossings' },
    'ans': 'B',
    'exp': 'Effective border surveillance and control are the core objectives of any Border Management Strategy.'
  },
  {
    'id': 'I34',
    'subject': 'IMMIGRATION_NIS',
    'q': 'What year was the NIS formally separated from the Nigeria Police Force and the Customs Department?',
    'options': { 'A': '1958', 'B': '1963', 'C': '1972', 'D': '1990' },
    'ans': 'B',
    'exp': 'The Immigration Act of 1963 solidified the NIS as a distinct entity.'
  },
  {
    'id': 'I35',
    'subject': 'IMMIGRATION_NIS',
    'q': 'Which rank is immediately below the Comptroller General of Immigration Service (CGIS)?',
    'options': { 'A': 'Zonal Coordinator', 'B': 'Assistant Comptroller General (ACG)', 'C': 'Deputy Comptroller General (DCG)', 'D': 'Comptroller of Immigration (CI)' },
    'ans': 'C',
    'exp': 'The Deputy Comptroller General (DCG) is the second highest rank, assisting the CGIS.'
  },
  {
    'id': 'I36',
    'subject': 'IMMIGRATION_NIS',
    'q': 'The NIS is the main agency for implementing the provisions of the ECOWAS Protocol on:',
    'options': { 'A': 'Trade Liberalisation', 'B': 'Free Movement of Persons, Residence and Establishment', 'C': 'Single Currency', 'D': 'Defence Pact' },
    'ans': 'B',
    'exp': 'The NIS facilitates the movement of ECOWAS citizens in line with the protocol on Free Movement.'
  },
  {
    'id': 'I37',
    'subject': 'IMMIGRATION_NIS',
    'q': 'In the NIS structure, who oversees the activities of several State Commands within a geographical area?',
    'options': { 'A': 'Area Commander', 'B': 'Zonal Coordinator/ACGI', 'C': 'State Comptroller', 'D': 'Sector Head' },
    'ans': 'B',
    'exp': 'The Zonal Coordinator, usually an Assistant Comptroller General of Immigration (ACGI), is in charge of a Zonal Command.'
  },
  {
    'id': 'I38',
    'subject': 'IMMIGRATION_NIS',
    'q': 'Which section handles the registration and documentation of non-Nigerian residents?',
    'options': { 'A': 'Passport Control Section', 'B': 'Visa Section', 'C': 'Aliens Registration and Biometrics Section', 'D': 'Border Patrol' },
    'ans': 'C',
    'exp': 'The Aliens Registration and Biometrics Section (or similar name) handles the formal documentation of foreigners.'
  },
  {
    'id': 'I39',
    'subject': 'IMMIGRATION_NIS',
    'q': 'The NIS uniform typically includes a peaked cap for senior officers and a beret for junior and intermediate ranks. What is the usual colour of the beret?',
    'options': { 'A': 'Red', 'B': 'Black', 'C': 'Green', 'D': 'Blue' },
    'ans': 'C',
    'exp': 'The NIS beret is typically green.'
  },
  {
    'id': 'I40',
    'subject': 'IMMIGRATION_NIS',
    'q': 'A core objective of the NIS Reform Agenda has been the transition to:',
    'options': { 'A': 'Manual filing systems', 'B': 'Full digitalization and biometric control systems', 'C': 'Increased use of physical patrols only', 'D': 'Elimination of all checkpoints' },
    'ans': 'B',
    'exp': 'Modernization focuses on digitalization and biometric technology for enhanced security and service delivery.'
  },
  {
    'id': 'I41',
    'subject': 'IMMIGRATION_NIS',
    'q': 'What is the NIS\'s role regarding Nigerian citizens deported from other countries?',
    'options': { 'A': 'They deny them entry', 'B': 'They receive and document them and hand them over to relevant authorities if necessary', 'C': 'They immediately re-issue their passports', 'D': 'They detain them indefinitely' },
    'ans': 'B',
    'exp': 'The NIS is responsible for the clearance and documentation of returning or deported Nigerians.'
  },
  {
    'id': 'I42',
    'subject': 'IMMIGRATION_NIS',
    'q': 'The NIS is actively involved in the implementation of the National Border Management Strategy (NBMS) which aims to:',
    'options': { 'A': 'Build more hotels near borders', 'B': 'Enhance security, facilitate legitimate movement, and boost border infrastructure', 'C': 'Increase the price of visas', 'D': 'Establish new foreign embassies' },
    'ans': 'B',
    'exp': 'The NBMS focuses on a holistic approach to border management, balancing security and facilitation.'
  },
  {
    'id': 'I43',
    'subject': 'IMMIGRATION_NIS',
    'q': 'Which document authorizes a non-Nigerian to enter the country, typically obtained before arrival?',
    'options': { 'A': 'Residence Permit', 'B': 'Visa', 'C': 'Electoral Card', 'D': 'National Identity Number' },
    'ans': 'B',
    'exp': 'A Visa is the required travel document granted to a non-Nigerian to enter Nigeria.'
  },
  {
    'id': 'I44',
    'subject': 'IMMIGRATION_NIS',
    'q': 'The Nigeria Immigration Service operates under the principles of:',
    'options': { 'A': 'Military Law', 'B': 'The Immigration Act 2015 and other relevant laws', 'C': 'Customs Tariffs', 'D': 'Local Government Bye-laws' },
    'ans': 'B',
    'exp': 'The service is governed primarily by the Immigration Act and subsidiary legislations.'
  },
  {
    'id': 'I45',
    'subject': 'IMMIGRATION_NIS',
    'q': 'What is the rank equivalent to a Deputy Comptroller General (DCG) in the NIS?',
    'options': { 'A': 'Assistant Inspector General of Police (AIG)', 'B': 'Deputy Inspector General of Police (DIG)', 'C': 'Commissioner of Police (CP)', 'D': 'Inspector General of Police (IGP)' },
    'ans': 'B',
    'exp': 'The DCG is the second highest rank, comparable to the Deputy Inspector General of Police (DIG).'
  },
  {
    'id': 'I46',
    'subject': 'IMMIGRATION_NIS',
    'q': 'One of the key challenges the NIS faces at land borders is:',
    'options': { 'A': 'Lack of adequate office furniture', 'B': 'Porous borders and proliferation of illegal routes', 'C': 'Too many trained personnel', 'D': 'High internet speed' },
    'ans': 'B',
    'exp': 'Porous borders and illegal crossing points pose a significant challenge to border control efforts.'
  },
  {
    'id': 'I47',
    'subject': 'IMMIGRATION_NIS',
    'q': 'Which section of the NIS manages travel documents for diplomatic and official personnel?',
    'options': { 'A': 'General Duties', 'B': 'Protocol/Diplomatic Relations Section', 'C': 'Audit', 'D': 'Training' },
    'ans': 'B',
    'exp': 'The Protocol/Diplomatic Relations Section is specialized in handling diplomatic clearances and documentation.'
  },
  {
    'id': 'I48',
    'subject': 'IMMIGRATION_NIS',
    'q': 'What is the primary significance of the NIS logo\'s shield?',
    'options': { 'A': 'Protection and defence of the nation\'s borders', 'B': 'Agricultural wealth', 'C': 'International cooperation', 'D': 'Economic prosperity' },
    'ans': 'A',
    'exp': 'The shield typically symbolizes protection and defence.'
  },
  {
    'id': 'I49',
    'subject': 'IMMIGRATION_NIS',
    'q': 'Recruitment into the NIS is primarily handled by the:',
    'options': { 'A': 'Federal Civil Service Commission (FCSC)', 'B': 'NIS Recruitment Board', 'C': 'Ministry of Finance', 'D': 'National Youth Service Corps (NYSC)' },
    'ans': 'B',
    'exp': 'The NIS Recruitment Board is responsible for the recruitment of personnel into the service, often in collaboration with the supervising ministry.'
  },
  {
    'id': 'I50',
    'subject': 'IMMIGRATION_NIS',
    'q': 'An officer with the rank of Comptroller of Immigration is typically addressed as:',
    'options': { 'A': 'Director', 'B': 'Chief Commander', 'C': 'Comptroller', 'D': 'General' },
    'ans': 'C',
    'exp': 'The officer is addressed by their rank, Comptroller.'
  }
   
    // CIVIL DEFENCE (NSCDC) - 15 Questions Pool
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
    'q': 'In the NSCDC rank structure, what is the highest rank below the Commandant General?',
    'options': { 'A': 'Senior Superintendent of Corps', 'B': 'Deputy Commandant General (DCG)', 'C': 'Assistant Commandant of Corps', 'D': 'Chief Corps Assistant' },
    'ans': 'B',
    'exp': 'The Deputy Commandant General (DCG) is the second highest rank.'
  },
  {
    'id': 'C8',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'Which rank is typically the entry point for a university degree holder (officer cadre) in the NSCDC?',
    'options': { 'A': 'Corps Assistant (CA)', 'B': 'Senior Corps Superintendent (SCS)', 'C': 'Assistant Superintendent of Corps II (ASC II)', 'D': 'Chief Corps Inspector' },
    'ans': 'C',
    'exp': 'Assistant Superintendent of Corps II is the standard entry-level rank for degree holders.'
  },
  {
    'id': 'C9',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'The NSCDC is also primarily responsible for the registration, licensing, and supervision of:',
    'options': { 'A': 'Commercial bus drivers', 'B': 'Private Guard Companies (PGCs)', 'C': 'Federal Universities', 'D': 'Oil Prospecting Licenses' },
    'ans': 'B',
    'exp': 'The NSCDC has the legal mandate to license and regulate Private Guard Companies in Nigeria.'
  },
  {
    'id': 'C10',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'What is the NSCDC\'s specific role during national emergencies or disasters?',
    'options': { 'A': 'Taking over the government', 'B': 'Carrying out civil defence activities and providing support to NEMA', 'C': 'Issuing travel bans', 'D': 'Monitoring stock exchange trading' },
    'ans': 'B',
    'exp': 'Disaster management and civil defence are core statutory mandates of the Corps.'
  },
  {
    'id': 'C11',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'What is the rank of the officer who heads a State Command in the NSCDC?',
    'options': { 'A': 'Commissioner of Corps', 'B': 'State Coordinator', 'C': 'Commandant of Corps (CC)', 'D': 'Brigadier' },
    'ans': 'C',
    'exp': 'A State Command is headed by a Commandant of Corps (CC).'
  },
  {
    'id': 'C12',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'The NSCDC was first given a mandate for permanent security duties in which year?',
    'options': { 'A': '1967', 'B': '1988', 'C': '2003', 'D': '2010' },
    'ans': 'C',
    'exp': 'The NSCDC Act of 2003 formally transformed it from a voluntary to a statutory para-military organization.'
  },
  {
    'id': 'C13',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'Which NSCDC Unit is specifically tasked with monitoring and protecting oil and gas installations?',
    'options': { 'A': 'Anti-Vandalism Unit', 'B': 'Medical Unit', 'C': 'Public Relations Unit', 'D': 'Welfare Unit' },
    'ans': 'A',
    'exp': 'The Anti-Vandalism Unit is specifically dedicated to pipeline protection and combating oil theft.'
  },
  {
    'id': 'C14',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'The NSCDC uniform is primarily which colour, giving it a distinctive appearance?',
    'options': { 'A': 'Red', 'B': 'Blue', 'C': 'Khaki/Ash-Grey', 'D': 'White' },
    'ans': 'C',
    'exp': 'The NSCDC uniform is distinctively Khaki/Ash-Grey or a light brown colour.'
  },
  {
    'id': 'C15',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'The NSCDC Corps Training College is located in which state, serving as a primary training ground?',
    'options': { 'A': 'Lagos', 'B': 'Katsina', 'C': 'Abuja (Sauka)', 'D': 'Rivers' },
    'ans': 'C',
    'exp': 'The NSCDC College of Security Management (or similar training institutions) is a key facility in Abuja.'
  },
  {
    'id': 'C16',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'The NSCDC has the statutory power to:',
    'options': { 'A': 'Declare war on other nations', 'B': 'Prosecute offenders in court for certain crimes (e.g., vandalism, minor offenses)', 'C': 'Issue national passports', 'D': 'Control the flow of foreign exchange' },
    'ans': 'B',
    'exp': 'The NSCDC Act grants the Corps power to investigate and prosecute certain offenses related to its mandate.'
  },
  {
    'id': 'C17',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'Which NSCDC rank is symbolized by the Nigerian Coat of Arms on the shoulder?',
    'options': { 'A': 'Assistant Commandant of Corps', 'B': 'Commandant General', 'C': 'Chief Corps Inspector', 'D': 'Corps Assistant I' },
    'ans': 'B',
    'exp': 'The Coat of Arms is the insignia of the Commandant General.'
  },
  {
    'id': 'C18',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'The NSCDC Peace and Conflict Resolution Unit is tasked with:',
    'options': { 'A': 'International peace negotiations', 'B': 'Handling minor civil disputes and conflicts via Alternative Dispute Resolution (ADR)', 'C': 'Organizing staff parties', 'D': 'Military drills' },
    'ans': 'B',
    'exp': 'ADR, conciliation, and mediation are crucial functions, especially at the grassroots level.'
  },
  {
    'id': 'C19',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'The NSCDC plays a key role in the security architecture by complementing the efforts of which main internal security agency?',
    'options': { 'A': 'Nigerian Navy', 'B': 'Nigerian Police Force', 'C': 'Nigerian Air Force', 'D': 'Federal Road Safety Corps' },
    'ans': 'B',
    'exp': 'The NSCDC complements the Nigerian Police Force in maintaining internal law and order.'
  },
  {
    'id': 'C20',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'What is the primary significance of the Eagle in the NSCDC logo?',
    'options': { 'A': 'Peace', 'B': 'Unity and Strength', 'C': 'Wealth', 'D': 'Speed' },
    'ans': 'B',
    'exp': 'The Eagle symbolizes national identity, strength, and authority.'
  },
  {
    'id': 'C21',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'The NSCDC is mandated to collaborate with NEMA for effective implementation of which strategy?',
    'options': { 'A': 'Monetary Policy', 'B': 'Disaster Management Strategy', 'C': 'Foreign Trade Policy', 'D': 'Oil Production Quota' },
    'ans': 'B',
    'exp': 'Collaboration with NEMA is essential for fulfilling the NSCDC\'s disaster management mandate.'
  },
  {
    'id': 'C22',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'The rank of \'Deputy Commandant of Corps\' is immediately below:',
    'options': { 'A': 'Commandant of Corps (CC)', 'B': 'Senior Corps Assistant', 'C': 'Assistant Commandant General (ACG)', 'D': 'Corps Assistant I' },
    'ans': 'A',
    'exp': 'Deputy Commandant of Corps (DCC) is directly beneath Commandant of Corps (CC).'
  },
  {
    'id': 'C23',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'One of the NSCDC\'s roles is the protection of Government buildings and:',
    'options': { 'A': 'Private farms', 'B': 'Federal institutions/infrastructure (e.g., dams, power stations)', 'C': 'Motor parks', 'D': 'Cinemas' },
    'ans': 'B',
    'exp': 'Protecting federal institutions and infrastructure is a core duty, particularly against vandalism.'
  },
  {
    'id': 'C24',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'Which NSCDC Unit is primarily involved in surveillance and information gathering for security purposes?',
    'options': { 'A': 'Music Unit', 'B': 'Intelligence and Investigation Unit', 'C': 'Sports Unit', 'D': 'Cleaning Unit' },
    'ans': 'B',
    'exp': 'The Intelligence and Investigation Unit is responsible for covert operations and information gathering.'
  },
  {
    'id': 'C25',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'What is the core difference in mandate between the NSCDC and the Nigeria Police Force (NPF)?',
    'options': { 'A': 'The NPF focuses on pipelines, NSCDC focuses on general crime.', 'B': 'The NSCDC focuses on Civil Defence, disaster management, and critical infrastructure protection, complementing the NPF\'s general law enforcement.', 'C': 'The NSCDC carries all the arms, the NPF carries none.', 'D': 'The NPF issues passports, the NSCDC issues licenses.' },
    'ans': 'B',
    'exp': 'The NSCDC\'s mandate is specialized in civil defence and critical infrastructure protection, which complements the NPF.'
  },
  {
    'id': 'C26',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'The NSCDC has the authority to prosecute cases related to:',
    'options': { 'A': 'Homicide and armed robbery only', 'B': 'Destruction of government property, illegal oil bunkering, and vandalism', 'C': 'Treason', 'D': 'International trade disputes' },
    'ans': 'B',
    'exp': 'The Corps\' prosecution power is focused on offenses related to its statutory functions, such as pipeline vandalism and unlawful destruction of national assets.'
  },
  {
    'id': 'C27',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'Which officer rank in the NSCDC is equivalent to an Inspector in the Police Force?',
    'options': { 'A': 'Assistant Commandant of Corps (ACC)', 'B': 'Chief Corps Inspector (CCI)', 'C': 'Corps Assistant I (CAI)', 'D': 'Deputy Commandant General (DCG)' },
    'ans': 'B',
    'exp': 'The Inspectorate Cadre of the NSCDC, led by the Chief Corps Inspector, is generally comparable to the Inspectorate Cadre in the Police.'
  },
  {
    'id': 'C28',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'The NSCDC\'s commitment to gender mainstreaming led to the creation of the:',
    'options': { 'A': 'Disaster Response Squad', 'B': 'Female Squad for security and protection of schools', 'C': 'Pipeline Protection Force', 'D': 'Music and Cultural Unit' },
    'ans': 'B',
    'exp': 'The Female Squad was established to enhance security, particularly in schools and vulnerable areas.'
  },
  {
    'id': 'C29',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'What significant development concerning the NSCDC occurred in the year 2007?',
    'options': { 'A': 'The Corps was disbanded', 'B': 'The NSCDC became officially recognized as an armed paramilitary force.', 'C': 'The Corps began issuing passports.', 'D': 'The Corps relocated its headquarters to Lagos.' },
    'ans': 'B',
    'exp': 'The NSCDC was authorized to carry arms in 2007, significantly enhancing its operational capacity.'
  },
  {
    'id': 'C30',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'The NSCDC operates under the directive of the National Security Adviser (NSA) in matters of:',
    'options': { 'A': 'Staff recruitment', 'B': 'Coordination of national internal security efforts', 'C': 'Uniform colours', 'D': 'Fuel price regulation' },
    'ans': 'B',
    'exp': 'All internal security agencies coordinate their efforts under the Office of the National Security Adviser.'
  },
  {
    'id': 'C31',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'Which piece of equipment is commonly used by the NSCDC\'s Anti-Vandalism Unit in monitoring pipelines?',
    'options': { 'A': 'Submarines', 'B': 'Satellite/Aerial surveillance and ground patrol vehicles', 'C': 'Heavy artillery', 'D': 'Tractors' },
    'ans': 'B',
    'exp': 'Monitoring is done through a combination of technology (satellite/drones) and physical ground patrols.'
  },
  {
    'id': 'C32',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'The NSCDC\'s mandate includes safeguarding educational institutions from:',
    'options': { 'A': 'Bad grades', 'B': 'Vandalism, theft, and kidnapping (especially the Female Squad)', 'C': 'Poor teaching', 'D': 'High school fees' },
    'ans': 'B',
    'exp': 'Protecting schools from attacks and criminal activities is a priority, especially in volatile regions.'
  },
  {
    'id': 'C33',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'In the NSCDC structure, who heads the various directorates at the National Headquarters?',
    'options': { 'A': 'Chief Corps Assistants', 'B': 'Deputy Commandant Generals (DCGs) or Assistant Commandant Generals (ACGs)', 'C': 'Zonal Commanders', 'D': 'Corps Assistants' },
    'ans': 'B',
    'exp': 'Senior officers (DCGs and ACGs) typically head the directorates.'
  },
  {
    'id': 'C34',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'What is the primary significance of the star symbol in the NSCDC officer rank insignia?',
    'options': { 'A': 'The number of states in Nigeria', 'B': 'Gradual increase in command authority and experience', 'C': 'The number of children the officer has', 'D': 'The number of hours worked' },
    'ans': 'B',
    'exp': 'Stars (Pips) and other symbols denote rank, experience, and authority in paramilitary organizations.'
  },
  {
    'id': 'C35',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'The NSCDC is charged with monitoring and protecting the infrastructure of which sector, apart from oil/gas?',
    'options': { 'A': 'Entertainment Industry', 'B': 'Telecommunications and Power Sectors', 'C': 'Agricultural Exports', 'D': 'Fashion Design' },
    'ans': 'B',
    'exp': 'Critical national infrastructure includes telecom masts, power lines, and dams, all under NSCDC protection.'
  },
  {
    'id': 'C36',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'The Corps Assistant cadre in the NSCDC is primarily composed of personnel with which entry qualification?',
    'options': { 'A': 'Master\'s Degree', 'B': 'SSCE/NECO/Trade Test', 'C': 'PhD', 'D': 'Only retired military personnel' },
    'ans': 'B',
    'exp': 'The Assistant Cadre is the general entry level for candidates with lower academic qualifications.'
  },
  {
    'id': 'C37',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'The \'Arms Squad\' of the NSCDC is responsible for:',
    'options': { 'A': 'Teaching history', 'B': 'Providing armed protection to personnel, installations, and during operations', 'C': 'Preparing lunch', 'D': 'Issuing travel visas' },
    'ans': 'B',
    'exp': 'The Arms Squad provides necessary firepower and protection for the Corps\' operations.'
  },
  {
    'id': 'C38',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'The NSCDC uses which method as an alternative to litigation for minor disputes?',
    'options': { 'A': 'Trial by combat', 'B': 'Alternative Dispute Resolution (ADR) and Mediation', 'C': 'Immediate capital punishment', 'D': 'Military court martial' },
    'ans': 'B',
    'exp': 'ADR/Mediation is a statutory function for settling minor civil disagreements.'
  },
  {
    'id': 'C39',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'The NSCDC\'s commitment to community safety often involves partnership with:',
    'options': { 'A': 'Foreign Governments only', 'B': 'Traditional rulers and Community Development Associations (CDAs)', 'C': 'International banks', 'D': 'Major sports leagues' },
    'ans': 'B',
    'exp': 'Community policing and civil defence rely heavily on local partnership, especially with traditional leaders.'
  },
  {
    'id': 'C40',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'The NSCDC Act was amended in which year to enhance its powers and operational efficiency?',
    'options': { 'A': '2003', 'B': '2007', 'C': '2010', 'D': '2019' },
    'ans': 'D',
    'exp': 'The NSCDC Act was amended in 2019 to give the Corps more contemporary powers.'
  },
  {
    'id': 'C41',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'What does the symbol of the torch in the NSCDC logo represent?',
    'options': { 'A': 'Agriculture', 'B': 'Light/Enlightenment and security awareness', 'C': 'Oil and gas', 'D': 'International trade' },
    'ans': 'B',
    'exp': 'The torch typically symbolizes enlightenment, knowledge, and guiding light.'
  },
  {
    'id': 'C42',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'The NSCDC is often deployed to maintain peace in areas experiencing:',
    'options': { 'A': 'Heavy rainfall', 'B': 'Inter-communal or farmer-herder clashes', 'C': 'High stock market returns', 'D': 'Fashion shows' },
    'ans': 'B',
    'exp': 'The Corps is deployed for internal security, especially during localized civil unrest or communal conflicts.'
  },
  {
    'id': 'C43',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'Which NSCDC rank is typically the lowest in the Superintendent Cadre?',
    'options': { 'A': 'Corps Assistant', 'B': 'Senior Corps Inspector', 'C': 'Assistant Superintendent of Corps II (ASC II)', 'D': 'Chief Corps Superintendent' },
    'ans': 'C',
    'exp': 'ASC II is the entry point for officers/superintendents.'
  },
  {
    'id': 'C44',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'The NSCDC actively participates in the recovery of which type of items after incidents like oil spills?',
    'options': { 'A': 'Stolen vehicles only', 'B': 'Oil products, vandalized materials, and exhibits for prosecution', 'C': 'Ancient artifacts', 'D': 'Fresh produce' },
    'ans': 'B',
    'exp': 'Recovery of stolen products and evidence is crucial for the Corps\' anti-vandalism mandate.'
  },
  {
    'id': 'C45',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'The training of NSCDC personnel is heavily focused on:',
    'options': { 'A': 'Theoretical philosophy', 'B': 'Military-style drills, self-defence, first aid, and disaster response', 'C': 'Advanced cooking techniques', 'D': 'Commercial airline pilot training' },
    'ans': 'B',
    'exp': 'Training covers paramilitary and civil defence skills necessary for their dual mandate.'
  },
  {
    'id': 'C46',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'The official colour of the NSCDC beret for operational staff is typically:',
    'options': { 'A': 'Red', 'B': 'Black', 'C': 'Green', 'D': 'Blue' },
    'ans': 'B',
    'exp': 'The Corps typically uses a black beret, often with the Corps crest.'
  },
  {
    'id': 'C47',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'The NSCDC works alongside the Federal Fire Service (FFS) in which area?',
    'options': { 'A': 'Passport issuance', 'B': 'Disaster management, rescue, and fire prevention awareness', 'C': 'Oil bunkering prosecution', 'D': 'Agricultural subsidy disbursement' },
    'ans': 'B',
    'exp': 'Both agencies have a core role in disaster management and response.'
  },
  {
    'id': 'C48',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'The Commandant General of the NSCDC is appointed by the:',
    'options': { 'A': 'Minister of Interior', 'B': 'President of the Federal Republic of Nigeria', 'C': 'Chief of Army Staff', 'D': 'Head of Service' },
    'ans': 'B',
    'exp': 'Heads of major federal paramilitary/security agencies are appointed by the President.'
  },
  {
    'id': 'C49',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'Which section of the NSCDC is dedicated to investigating economic crimes related to its mandate (e.g., illegal oil bunkering)?',
    'options': { 'A': 'Press Unit', 'B': 'Forensic and Investigation Unit (or similar specialized unit)', 'C': 'Transport Unit', 'D': 'Protocol Unit' },
    'ans': 'B',
    'exp': 'Specialized units handle complex crimes requiring investigation and forensic expertise.'
  },
  {
    'id': 'C50',
    'subject': 'CIVIL_DEFENCE_NSCDC',
    'q': 'The statutory function of the NSCDC to \'assist in the maintenance of peace and order\' implies collaboration with:',
    'options': { 'A': 'Foreign Military Forces', 'B': 'Other law enforcement and security agencies', 'C': 'International NGOs only', 'D': 'Local restaurants' },
    'ans': 'B',
    'exp': 'Effective maintenance of peace requires inter-agency collaboration.'
  }

    // CORRECTIONAL CENTER (NCS) - 15 Questions Pool
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
    'q': 'What is the official motto of the Nigerian Correctional Service?',
    'options': { 'A': 'Safety First', 'B': 'The Ultimate Goal is to Reform', 'C': 'Punishment and Justice', 'D': 'Defence of the Nation' },
    'ans': 'B',
    'exp': 'A common motto reflecting its mandate is \'The Ultimate Goal is to Reform\' or \'Reform, Rehabilitate, and Reintegrate\'.'
  },
  {
    'id': 'N7',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'Which key division of the NCoS is responsible for the academic and vocational training of inmates?',
    'options': { 'A': 'Security/Operations', 'B': 'Inmate Training and Rehabilitation', 'C': 'General Administration', 'D': 'Logistics' },
    'ans': 'B',
    'exp': 'The Inmate Training and Rehabilitation Directorate oversees all programs aimed at skill development and education.'
  },
  {
    'id': 'N8',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'The NCoS is divided into how many operational directorates at the National Headquarters level?',
    'options': { 'A': '2', 'B': '6-8 (depending on current structure)', 'C': '15', 'D': '37' },
    'ans': 'B',
    'exp': 'The NCoS, like other federal agencies, is structured into various operational directorates (e.g., Operations, Administration, Health, Inmate Training, etc.).'
  },
  {
    'id': 'N9',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'What is the role of the Non-Custodial Service component of the NCoS?',
    'options': { 'A': 'Detaining high-profile offenders only', 'B': 'Managing community service, parole, and probation for minor offenders outside the custodial facility', 'C': 'Issuing travel documents', 'D': 'Operating state prisons' },
    'ans': 'B',
    'exp': 'Non-Custodial Service manages alternatives to incarceration as mandated by the 2019 Act.'
  },
  {
    'id': 'N10',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'The official uniform colour of the Nigerian Correctional Service is primarily:',
    'options': { 'A': 'White', 'B': 'Green and Black/Navy Blue', 'C': 'Red', 'D': 'Yellow' },
    'ans': 'B',
    'exp': 'The official uniform is often green or a combination of green and navy blue/black, often with a green cap/beret.'
  },
  {
    'id': 'N11',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'Which officer rank in the NCoS is equivalent to a Commissioner of Police?',
    'options': { 'A': 'Assistant Controller of Corrections (ACC)', 'B': 'Controller of Corrections (CC)', 'C': 'Superintendent of Corrections (SC)', 'D': 'Chief Warder' },
    'ans': 'B',
    'exp': 'Controller of Corrections (CC) is generally the rank used for State Command heads, equivalent to CP.'
  },
  {
    'id': 'N12',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'The logo of the NCoS typically features an open book, symbolizing:',
    'options': { 'A': 'Punishment', 'B': 'Reformation through education and skills acquisition', 'C': 'Secrecy', 'D': 'Economic prosperity' },
    'ans': 'B',
    'exp': 'The open book and other symbols represent the focus on education and reformation.'
  },
  {
    'id': 'N13',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'What is the highest rank in the NCoS after the Controller General of Corrections (CGC)?',
    'options': { 'A': 'Assistant Controller General of Corrections (ACGC)', 'B': 'Deputy Controller General of Corrections (DCGC)', 'C': 'Controller of Corrections (CC)', 'D': 'Warder Major' },
    'ans': 'B',
    'exp': 'The Deputy Controller General of Corrections (DCGC) is the second highest rank.'
  },
  {
    'id': 'N14',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'The NCoS\'s operational structure includes a maximum security prison located in:',
    'options': { 'A': 'Calabar', 'B': 'Kirikiri (Lagos)', 'C': 'Maiduguri', 'D': 'Aba' },
    'ans': 'B',
    'exp': 'Kirikiri Maximum Security Prison in Lagos is Nigeria\'s most famous high-security facility.'
  },
  {
    'id': 'N15',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'A core objective of the NCoS is to manage the welfare of:',
    'options': { 'A': 'Only convicted inmates', 'B': 'Inmates (convicted and awaiting trial) and staff', 'C': 'Prison suppliers only', 'D': 'Ex-convicts only' },
    'ans': 'B',
    'exp': 'Welfare management covers all inmates and the well-being of the staff who manage them.'
  },
  {
    'id': 'N16',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'The NCoS is responsible for providing which essential service to inmates?',
    'options': { 'A': 'Free international travel', 'B': 'Medical care, feeding, and legal access', 'C': 'Daily cash allowance', 'D': 'Smartphone access' },
    'ans': 'B',
    'exp': 'Provision of medical care, food, and enabling access to justice are basic requirements for inmate management.'
  },
  {
    'id': 'N17',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'Which officer cadre in the NCoS is typically the entry point for HND/B.Sc holders?',
    'options': { 'A': 'Assistant Cadre', 'B': 'Superintendent Cadre (Assistant Superintendent of Corrections)', 'C': 'Controller Cadre', 'D': 'Support Staff' },
    'ans': 'B',
    'exp': 'The Superintendent Cadre (e.g., ASC II) is the standard entry point for graduates.'
  },
  {
    'id': 'N18',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'The primary challenge addressed by the 2019 NCoS Act is:',
    'options': { 'A': 'Lack of uniforms', 'B': 'Overcrowding in correctional facilities and the high number of awaiting trial inmates', 'C': 'Low staff salary', 'D': 'Poor internet connection' },
    'ans': 'B',
    'exp': 'Overcrowding and the large number of awaiting trial inmates (ATI) are the most significant systemic challenges the Act seeks to address.'
  },
  {
    'id': 'N19',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'The NCoS plays a crucial role in the justice system by providing what service to the courts?',
    'options': { 'A': 'Legal advice', 'B': 'Production of inmates for court appearances', 'C': 'Setting bail conditions', 'D': 'Appointing judges' },
    'ans': 'B',
    'exp': 'The NCoS ensures that inmates are available for their judicial proceedings.'
  },
  {
    'id': 'N20',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'What is the significance of the two arms of service created by the NCoS Act 2019?',
    'options': { 'A': 'Male and Female Inmates', 'B': 'Custodial Service and Non-Custodial Service', 'C': 'Security and Welfare', 'D': 'Federal and State Prisons' },
    'ans': 'B',
    'exp': 'The Act formally separated the NCoS into Custodial (for detention) and Non-Custodial (for alternatives to incarceration) services.'
  },
  {
    'id': 'N21',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'The \'After-Care Services\' provided by the NCoS are aimed at:',
    'options': { 'A': 'Current inmates only', 'B': 'Helping ex-inmates reintegrate into society and preventing recidivism', 'C': 'Staff retired from service', 'D': 'International charity organizations' },
    'ans': 'B',
    'exp': 'After-care is vital for post-release support to ensure successful reintegration and reduce the rate of re-offending (recidivism).'
  },
  {
    'id': 'N22',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'Which NCoS rank is immediately below the Controller General of Corrections?',
    'options': { 'A': 'Assistant Controller General of Corrections (ACGC)', 'B': 'Deputy Controller General of Corrections (DCGC)', 'C': 'Controller of Corrections (CC)', 'D': 'Warder Major' },
    'ans': 'B',
    'exp': 'The Deputy Controller General of Corrections (DCGC) is the immediate deputy to the CGC.'
  },
  {
    'id': 'N23',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'The NCoS Act mandates collaboration with which non-governmental entities for inmate welfare and skill acquisition?',
    'options': { 'A': 'Military Contractors', 'B': 'Faith-based organizations, NGOs, and the private sector', 'C': 'Foreign Embassies only', 'D': 'Local traffic wardens' },
    'ans': 'B',
    'exp': 'Community and private sector involvement is essential for effective rehabilitation and reintegration.'
  },
  {
    'id': 'N24',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'The main security apparatus within the NCoS is responsible for:',
    'options': { 'A': 'Managing staff leave', 'B': 'Prevention of escape, internal security, and maintaining discipline within the facilities', 'C': 'International investment', 'D': 'Inmate clothing design' },
    'ans': 'B',
    'exp': 'Security/Operations Directorate is responsible for maintaining order and preventing security breaches.'
  },
  {
    'id': 'N25',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'What is the term for the process of determining an inmate\'s risk level and placement in the correctional system?',
    'options': { 'A': 'Registration', 'B': 'Classification and Sentencing', 'C': 'Muster Roll Call', 'D': 'Catering Assignment' },
    'ans': 'B',
    'exp': 'Classification and profiling determine the appropriate level of security and intervention for each inmate.'
  },
  {
    'id': 'N26',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'The rank of \'Assistant Controller General of Corrections (ACGC)\' typically heads which level of command?',
    'options': { 'A': 'A single correctional centre', 'B': 'A Zonal Command (covering multiple states)', 'C': 'The National Headquarters', 'D': 'A State Command' },
    'ans': 'B',
    'exp': 'ACGCs typically serve as Zonal Coordinators, overseeing several state commands.'
  },
  {
    'id': 'N27',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'The NCoS encourages inmates to acquire vocational skills such as tailoring, carpentry, and welding primarily to:',
    'options': { 'A': 'Make money for the service', 'B': 'Equip them for self-reliance and reduce recidivism upon release', 'C': 'Keep them busy', 'D': 'Decorate the facility' },
    'ans': 'B',
    'exp': 'Skill acquisition is the foundation of rehabilitation and successful reintegration.'
  },
  {
    'id': 'N28',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'Which officer rank in the NCoS is typically the most senior rank for the Inspectorate Cadre?',
    'options': { 'A': 'Controller of Corrections (CC)', 'B': 'Chief Inspector of Corrections (CIC)', 'C': 'Correctional Assistant I (CAI)', 'D': 'Deputy Controller General (DCGC)' },
    'ans': 'B',
    'exp': 'Chief Inspector of Corrections is the highest rank in the Inspectorate Cadre.'
  },
  {
    'id': 'N29',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'The NCoS provides specialized correctional facilities for which vulnerable group?',
    'options': { 'A': 'Foreign tourists', 'B': 'Juveniles and female offenders', 'C': 'Only very elderly men', 'D': 'Political office holders' },
    'ans': 'B',
    'exp': 'The service maintains separate facilities for women and focuses on specialized treatment for juveniles.'
  },
  {
    'id': 'N30',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'What is the primary role of the NCoS\'s Legal Department?',
    'options': { 'A': 'Managing staff payroll', 'B': 'Handling legal issues, prosecuting staff offenses, and advising on law relating to custody', 'C': 'Designing new uniforms', 'D': 'Operating the prison farm' },
    'ans': 'B',
    'exp': 'The Legal Department provides legal support and ensures compliance with the Correctional Service Act and other laws.'
  },
  {
    'id': 'N31',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'The 2019 NCoS Act introduces the concept of which maximum term for Non-Custodial sentences?',
    'options': { 'A': '1 year', 'B': '10 years', 'C': '5 years', 'D': '3 months' },
    'ans': 'C',
    'exp': 'The Act provides for a non-custodial sentence (e.g., community service) not exceeding 5 years.'
  },
  {
    'id': 'N32',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'The NCoS emblem features a key, symbolizing:',
    'options': { 'A': 'The wealth of Nigeria', 'B': 'The authority and responsibility of keeping inmates in safe custody', 'C': 'Access to international airports', 'D': 'A secret entrance' },
    'ans': 'B',
    'exp': 'The key is a universal symbol of control over the facility and the inmates.'
  },
  {
    'id': 'N33',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'The NCoS is actively involved in generating data on inmates for national crime statistics, in collaboration with:',
    'options': { 'A': 'Central Bank of Nigeria (CBN)', 'B': 'National Bureau of Statistics (NBS) and relevant security agencies', 'C': 'Foreign Affairs Ministry', 'D': 'Local market associations' },
    'ans': 'B',
    'exp': 'Data on inmate demographics and crime types are crucial for national statistics and policy planning.'
  },
  {
    'id': 'N34',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'An officer with the rank of \'Assistant Superintendent of Corrections I\' typically wears the insignia of:',
    'options': { 'A': 'The Coat of Arms', 'B': 'Two stars (pips)', 'C': 'A single star (pip)', 'D': 'A crown' },
    'ans': 'B',
    'exp': 'ASC I is the second rank in the Superintendent Cadre, often marked by two stars.'
  },
  {
    'id': 'N35',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'What is the NCoS\'s goal regarding inmates\' health and sanitation?',
    'options': { 'A': 'To ignore it completely', 'B': 'To ensure inmates enjoy a standard of health-care and hygiene comparable to the general public', 'C': 'To provide only spiritual care', 'D': 'To rely solely on external volunteers for everything' },
    'ans': 'B',
    'exp': 'The NCoS Act mandates the provision of adequate health and hygiene standards.'
  },
  {
    'id': 'N36',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'The NCoS operates special facilities dedicated to which major reform program?',
    'options': { 'A': 'International Diplomacy School', 'B': 'Inmate Education and Vocational Training Centres', 'C': 'Staff Recruitment Centres only', 'D': 'Currency Printing' },
    'ans': 'B',
    'exp': 'Dedicated centres facilitate intensive and structured training and education programs.'
  },
  {
    'id': 'N37',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'The process of \'De-radicalization\' within the NCoS is primarily targeted at inmates involved in:',
    'options': { 'A': 'Minor theft', 'B': 'Terrorism and violent extremism', 'C': 'Traffic offenses', 'D': 'International trade' },
    'ans': 'B',
    'exp': 'De-radicalization programs are specialized interventions for extremist and terrorist inmates.'
  },
  {
    'id': 'N38',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'Which officer is responsible for the overall security and administration of a Correctional Centre?',
    'options': { 'A': 'The State Governor', 'B': 'The Officer in Charge (O.I.C.) or Controller of the facility', 'C': 'The Chief Justice', 'D': 'The Area Commander' },
    'ans': 'B',
    'exp': 'The O.I.C., often a Controller or Deputy Controller, is the head of the facility.'
  },
  {
    'id': 'N39',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'The NCoS is mandated to allow inmates access to legal representation and:',
    'options': { 'A': 'Unlimited cash', 'B': 'Family visits and mail correspondence', 'C': 'Private jet travel', 'D': 'Military secrets' },
    'ans': 'B',
    'exp': 'Access to family and correspondence is a fundamental right and key to rehabilitation.'
  },
  {
    'id': 'N40',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'The introduction of Non-Custodial Service is primarily a measure to reduce:',
    'options': { 'A': 'Staff morale', 'B': 'The inmate population and decongest correctional centres', 'C': 'The price of food', 'D': 'The number of prison breaks' },
    'ans': 'B',
    'exp': 'Non-custodial sentences are a core strategy for prison decongestion.'
  },
  {
    'id': 'N41',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'The rank of \'Superintendent of Corrections (SC)\' is senior to which of these ranks?',
    'options': { 'A': 'Controller of Corrections (CC)', 'B': 'Assistant Superintendent of Corrections I (ASC I)', 'C': 'Deputy Controller General (DCGC)', 'D': 'Assistant Controller General (ACGC)' },
    'ans': 'B',
    'exp': 'SC is senior to ASC I, which is a junior officer rank.'
  },
  {
    'id': 'N42',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'What is the NCoS\'s role in the event of a prison break/jailbreak?',
    'options': { 'A': 'To ignore it as a local matter', 'B': 'To immediately mobilize for recapture and launch an internal investigation', 'C': 'To declare a national holiday', 'D': 'To blame another agency' },
    'ans': 'B',
    'exp': 'Swift recapture and internal investigation are mandatory security protocols after a jailbreak.'
  },
  {
    'id': 'N43',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'The NCoS works closely with the judiciary to implement measures to speed up the trials of:',
    'options': { 'A': 'Convicted inmates', 'B': 'Awaiting Trial Inmates (ATI)', 'C': 'Staff on leave', 'D': 'Retired officers' },
    'ans': 'B',
    'exp': 'Reducing the ATI population is a core strategy for decongestion.'
  },
  {
    'id': 'N44',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'The NCoS encourages which type of education among inmates, from basic literacy to tertiary level?',
    'options': { 'A': 'Only military training', 'B': 'Academic Education', 'C': 'Only religious studies', 'D': 'Online gaming' },
    'ans': 'B',
    'exp': 'Academic education is a major part of the NCoS reform program.'
  },
  {
    'id': 'N45',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'What year was the Nigerian Prisons Service (NPS) originally established, pre-independence?',
    'options': { 'A': '1901 (with the establishment of the first formal prison)', 'B': '1960', 'C': '1999', 'D': '2019' },
    'ans': 'A',
    'exp': 'The formal prison system in Nigeria traces its origins back to the colonial era, specifically 1901 with the building of prisons.'
  },
  {
    'id': 'N46',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'The rank insignia for a \'Controller General of Corrections\' typically includes the national Coat of Arms and:',
    'options': { 'A': 'Four stars (pips)', 'B': 'A crossed staff and key/baton', 'C': 'Five stars (pips)', 'D': 'A single stripe' },
    'ans': 'B',
    'exp': 'The CGC insignia usually features the Coat of Arms and a crossed staff and key/baton, representing the authority over the service.'
  },
  {
    'id': 'N47',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'The NCoS Act requires that every State have a committee to monitor which aspect of the correctional system?',
    'options': { 'A': 'Staff recruitment', 'B': 'The conditions of custodial centres and inmate welfare/rehabilitation programs', 'C': 'International investment', 'D': 'Uniform procurement' },
    'ans': 'B',
    'exp': 'Monitoring committees are mandated to ensure accountability and humane treatment of inmates.'
  },
  {
    'id': 'N48',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'The NCoS uses the term \'Correctional Centre\' instead of \'Prison\' to emphasize:',
    'options': { 'A': 'A change in name only', 'B': 'The focus on correction, rehabilitation, and social reintegration of offenders', 'C': 'The building\'s height', 'D': 'Its location' },
    'ans': 'B',
    'exp': 'The name change reflects the shift in philosophy and mandate from punitive to reformative.'
  },
  {
    'id': 'N49',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'The rank of \'Assistant Controller of Corrections (ACC)\' is immediately below:',
    'options': { 'A': 'Controller of Corrections (CC)', 'B': 'Deputy Controller General (DCGC)', 'C': 'Assistant Superintendent of Corrections II (ASC II)', 'D': 'Chief Warder' },
    'ans': 'A',
    'exp': 'ACC is the junior rank to CC within the senior officer cadre.'
  },
  {
    'id': 'N50',
    'subject': 'CORRECTIONAL_NCS',
    'q': 'The NCoS works with which agency to provide psychiatric support for inmates with mental health challenges?',
    'options': { 'A': 'Federal Road Safety Corps', 'B': 'Federal Ministry of Health and specialized mental health institutions', 'C': 'Foreign Embassies', 'D': 'Customs Service' },
    'ans': 'B',
    'exp': 'The provision of mental health care is a crucial aspect of inmate welfare and rehabilitation, requiring collaboration with health authorities.'
  }
                
    // FEDERAL FIRE SERVICE (FFS) - 15 Questions Pool
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
    'q': 'Which of these is the highest rank below the Controller General in the FFS structure?',
    'options': { 'A': 'Assistant Controller of Fire', 'B': 'Deputy Controller General of Fire (DCGF)', 'C': 'Senior Fire Superintendent', 'D': 'Chief Fireman' },
    'ans': 'B',
    'exp': 'The Deputy Controller General of Fire is the second highest rank.'
  },
  {
    'id': 'F6',
    'subject': 'FIRE_FFS',
    'q': 'What is the popular motto associated with the Federal Fire Service?',
    'options': { 'A': 'Saving Lives and Properties', 'B': 'Integrity and Border Security', 'C': 'Peace and Security', 'D': 'The Customer is King' },
    'ans': 'A',
    'exp': 'A widely used motto reflecting the FFS mandate is \'Saving Lives and Properties\'.'
  },
  {
    'id': 'F7',
    'subject': 'FIRE_FFS',
    'q': 'FFS is responsible for setting and enforcing standards for fire safety in:',
    'options': { 'A': 'Only Federal Government buildings', 'B': 'Public and private buildings nationwide', 'C': 'Only military barracks', 'D': 'Oil pipelines only' },
    'ans': 'B',
    'exp': 'The FFS is mandated to set and enforce fire safety standards across the nation.'
  },
  {
    'id': 'F8',
    'subject': 'FIRE_FFS',
    'q': 'What is the rank of the officer in charge of a typical FFS State Command?',
    'options': { 'A': 'State Governor', 'B': 'Area Commander', 'C': 'Controller of Fire', 'D': 'Sector Commander' },
    'ans': 'C',
    'exp': 'The head of a State Fire Command is generally a Controller of Fire (CF).'
  },
  {
    'id': 'F9',
    'subject': 'FIRE_FFS',
    'q': 'The FFS uniform is primarily which colour, reflecting its emergency nature?',
    'options': { 'A': 'Green', 'B': 'Blue', 'C': 'Red', 'D': 'Black' },
    'ans': 'D',
    'exp': 'The operational uniforms of the FFS are typically black or navy blue, with reflective strips for safety.'
  },
  {
    'id': 'F10',
    'subject': 'FIRE_FFS',
    'q': 'Which piece of legislation governs the establishment and operation of the FFS?',
    'options': { 'A': 'Police Act', 'B': 'Federal Fire Service Act (or similar Fire Service Law)', 'C': 'Customs Act', 'D': 'Immigration Act' },
    'ans': 'B',
    'exp': 'The FFS is governed by the Federal Fire Service Act (as amended).'
  },
  {
    'id': 'F11',
    'subject': 'FIRE_FFS',
    'q': 'What does \'Mitigation\' refer to in the context of fire service duties?',
    'options': { 'A': 'Preventing the fire from starting', 'B': 'Reducing the negative impacts of a fire or disaster', 'C': 'Conducting post-fire investigation', 'D': 'Training new firemen' },
    'ans': 'B',
    'exp': 'Mitigation means reducing the severity, seriousness, or painfulness of something, in this case, a fire incident.'
  },
  {
    'id': 'F12',
    'subject': 'FIRE_FFS',
    'q': 'FFS is actively involved in training which other level of fire service personnel in Nigeria?',
    'options': { 'A': 'Only military fire personnel', 'B': 'State Fire Service personnel', 'C': 'Airport fire personnel only', 'D': 'No training of external bodies' },
    'ans': 'B',
    'exp': 'The FFS provides support and training standards for State and other fire services across Nigeria.'
  },
  {
    'id': 'F13',
    'subject': 'FIRE_FFS',
    'q': 'What is the FFS\'s role in the event of building collapse?',
    'options': { 'A': 'Traffic control', 'B': 'Post-disaster audit only', 'C': 'Search and Rescue (SAR) operations', 'D': 'Issuance of building permits' },
    'ans': 'C',
    'exp': 'Rescue is a crucial mandate of the FFS, particularly in structural collapse incidents.'
  },
  {
    'id': 'F14',
    'subject': 'FIRE_FFS',
    'q': 'Which rank is generally an entry-level position for a university graduate in the FFS?',
    'options': { 'A': 'Fireman I', 'B': 'Assistant Superintendent of Fire (ASF)', 'C': 'Chief Fire Officer', 'D': 'Deputy Controller of Fire' },
    'ans': 'B',
    'exp': 'Assistant Superintendent of Fire is typically the entry point for degree holders in the officer cadre.'
  },
  {
    'id': 'F15',
    'subject': 'FIRE_FFS',
    'q': 'The FFS Head Office is located in:',
    'options': { 'A': 'Lagos', 'B': 'Enugu', 'C': 'Abuja (FCT)', 'D': 'Port Harcourt' },
    'ans': 'C',
    'exp': 'The headquarters of the Federal Fire Service is located in the Federal Capital Territory, Abuja.'
  },
  {
    'id': 'F16',
    'subject': 'FIRE_FFS',
    'q': 'What is the main purpose of a \'Fire Drill\' conducted by FFS in public buildings?',
    'options': { 'A': 'To test the building\'s structural integrity', 'B': 'To practice quick and safe evacuation procedures', 'C': 'To generate revenue', 'D': 'To check staff attendance' },
    'ans': 'B',
    'exp': 'Fire drills are essential for training occupants on safe and rapid evacuation during a fire.'
  },
  {
    'id': 'F17',
    'subject': 'FIRE_FFS',
    'q': 'Which type of equipment is used by the FFS to extinguish fires involving flammable liquids (e.g., petrol)?',
    'options': { 'A': 'Water hoses only', 'B': 'Foam and specialized chemical extinguishers', 'C': 'Sand buckets only', 'D': 'Oxygen tanks' },
    'ans': 'B',
    'exp': 'Fires involving flammable liquids require foam or specific chemical extinguishers (Class B fires).'
  },
  {
    'id': 'F18',
    'subject': 'FIRE_FFS',
    'q': 'The rank of \'Senior Fire Superintendent (SFS)\' falls within which cadre?',
    'options': { 'A': 'General Duty', 'B': 'Assistant Cadre', 'C': 'Superintendent Cadre', 'D': 'Control Cadre' },
    'ans': 'C',
    'exp': 'The rank SFS is part of the Superintendent Cadre.'
  },
  {
    'id': 'F19',
    'subject': 'FIRE_FFS',
    'q': 'What is the primary objective of fire inspection by FFS officials?',
    'options': { 'A': 'To check interior decoration', 'B': 'To ensure compliance with fire safety regulations and identify hazards', 'C': 'To assess air conditioning systems', 'D': 'To monitor security guards' },
    'ans': 'B',
    'exp': 'Inspections are carried out to ensure public safety and compliance with fire codes.'
  },
  {
    'id': 'F20',
    'subject': 'FIRE_FFS',
    'q': 'Which international body does the FFS often collaborate with for modern firefighting techniques and training?',
    'options': { 'A': 'Interpol', 'B': 'International Association of Fire Chiefs (IAFC) or similar global fire agencies', 'C': 'World Bank', 'D': 'Red Cross' },
    'ans': 'B',
    'exp': 'FFS engages with international fire service organizations for capacity building.'
  },
  {
    'id': 'F21',
    'subject': 'FIRE_FFS',
    'q': 'The emblem of the FFS typically features which key element related to safety?',
    'options': { 'A': 'A Sword', 'B': 'A Ladder and Fire Axe', 'C': 'An Oil Rig', 'D': 'A Book' },
    'ans': 'B',
    'exp': 'The ladder and axe are universal symbols of the Fire Service, representing rescue and forcible entry.'
  },
  {
    'id': 'F22',
    'subject': 'FIRE_FFS',
    'q': 'In the event of a major national disaster involving fire or explosion, the FFS works most closely with:',
    'options': { 'A': 'Nigerian Ports Authority', 'B': 'National Emergency Management Agency (NEMA)', 'C': 'Federal Inland Revenue Service', 'D': 'Judiciary' },
    'ans': 'B',
    'exp': 'NEMA is the federal agency responsible for coordinating disaster management, making them a primary partner.'
  },
  {
    'id': 'F23',
    'subject': 'FIRE_FFS',
    'q': 'What is the specialized section of the FFS that investigates the cause and origin of a fire?',
    'options': { 'A': 'Administrative Section', 'B': 'Fire Investigation Unit', 'C': 'Logistics Department', 'D': 'Public Relations Office' },
    'ans': 'B',
    'exp': 'The Fire Investigation Unit is dedicated to determining the specifics of a fire incident.'
  },
  {
    'id': 'F24',
    'subject': 'FIRE_FFS',
    'q': 'The primary role of the Federal Fire Service is NOT to fight fires in:',
    'options': { 'A': 'Federal Secretariats', 'B': 'High-rise commercial buildings in Abuja', 'C': 'Aircraft on the tarmac (handled by FAAN/Aviation Fire)', 'D': 'Major markets in Lagos' },
    'ans': 'C',
    'exp': 'Aircraft and airport firefighting are primarily handled by the Federal Airports Authority of Nigeria (FAAN) Fire Service, though FFS may provide support.'
  },
  {
    'id': 'F25',
    'subject': 'FIRE_FFS',
    'q': 'The most common class of fire involving ordinary combustible materials like wood and paper is:',
    'options': { 'A': 'Class A', 'B': 'Class B', 'C': 'Class C', 'D': 'Class D' },
    'ans': 'A',
    'exp': 'Class A fires involve solid materials of an organic nature.'
  },
  {
    'id': 'F26',
    'subject': 'FIRE_FFS',
    'q': 'What is the primary function of a \'Hydrant\' in firefighting?',
    'options': { 'A': 'To store firefighting equipment', 'B': 'To provide access to a water supply for fire engines', 'C': 'To communicate with headquarters', 'D': 'To monitor air quality' },
    'ans': 'B',
    'exp': 'Fire hydrants are essential for connecting fire engines to a reliable, pressurized water source.'
  },
  {
    'id': 'F27',
    'subject': 'FIRE_FFS',
    'q': 'What does the acronym \'FFS\' stand for?',
    'options': { 'A': 'Federal Forces Security', 'B': 'First Fire Safety', 'C': 'Federal Fire Service', 'D': 'Fast Fire Suppression' },
    'ans': 'C',
    'exp': 'FFS stands for Federal Fire Service.'
  },
  {
    'id': 'F28',
    'subject': 'FIRE_FFS',
    'q': 'Training for new recruits in the FFS focuses heavily on:',
    'options': { 'A': 'Financial accounting and auditing', 'B': 'Physical fitness and rapid response techniques', 'C': 'International diplomacy', 'D': 'Customs clearance' },
    'ans': 'B',
    'exp': 'Physical fitness, operational drills, and rapid response are core elements of fire service training.'
  },
  {
    'id': 'F29',
    'subject': 'FIRE_FFS',
    'q': 'The officer rank \'Assistant Controller of Fire\' is immediately below:',
    'options': { 'A': 'Controller of Fire (CF)', 'B': 'Fireman I', 'C': 'Senior Fire Superintendent (SFS)', 'D': 'Deputy Controller General of Fire (DCGF)' },
    'ans': 'A',
    'exp': 'Assistant Controller of Fire (ACF) is directly beneath Controller of Fire (CF).'
  },
  {
    'id': 'F30',
    'subject': 'FIRE_FFS',
    'q': 'What is the term for the process of ventilating a burning building to remove heat and smoke?',
    'options': { 'A': 'Hydration', 'B': 'Extrication', 'C': 'Ventilation', 'D': 'Insulation' },
    'ans': 'C',
    'exp': 'Ventilation in firefighting is the planned introduction of fresh air and removal of smoke/heat to improve conditions for victims and firefighters.'
  },
  {
    'id': 'F31',
    'subject': 'FIRE_FFS',
    'q': 'The FFS typically uses which colour for its fire trucks/apparatus?',
    'options': { 'A': 'White', 'B': 'Red', 'C': 'Yellow', 'D': 'Green' },
    'ans': 'B',
    'exp': 'Fire trucks are almost universally red for high visibility and historical reasons.'
  },
  {
    'id': 'F32',
    'subject': 'FIRE_FFS',
    'q': 'A core mandate of the FFS is the provision of:',
    'options': { 'A': 'Armed escort for VIPs', 'B': 'Ambulance and first-aid services at incident scenes', 'C': 'Weather forecasting', 'D': 'Collection of tariffs' },
    'ans': 'B',
    'exp': 'Emergency response often includes the provision of medical (first-aid/ambulance) services alongside fire and rescue.'
  },
  {
    'id': 'F33',
    'subject': 'FIRE_FFS',
    'q': 'The FFS operates at the federal level, while which entities manage local/grassroots fire response?',
    'options': { 'A': 'Military Barracks', 'B': 'State and Local Government Fire Services', 'C': 'University Security', 'D': 'Private Security Guards' },
    'ans': 'B',
    'exp': 'Fire services are generally decentralized to State and Local Government levels for localized response.'
  },
  {
    'id': 'F34',
    'subject': 'FIRE_FFS',
    'q': 'What is the key role of the FFS Public Relations Unit?',
    'options': { 'A': 'Fighting fires', 'B': 'Recruiting staff', 'C': 'Creating public awareness on fire prevention and safety', 'D': 'Managing the Controller General\'s finances' },
    'ans': 'C',
    'exp': 'The Public Relations Unit plays a vital role in public education and sensitization on safety issues.'
  },
  {
    'id': 'F35',
    'subject': 'FIRE_FFS',
    'q': 'What is the most critical factor for the FFS in its response to an emergency?',
    'options': { 'A': 'Cost of operation', 'B': 'Speed and efficiency of the response time', 'C': 'The gender of the victims', 'D': 'The colour of the building' },
    'ans': 'B',
    'exp': 'Response time is the most critical factor in mitigating loss of life and property in emergencies.'
  },
  {
    'id': 'F36',
    'subject': 'FIRE_FFS',
    'q': 'The FFS is currently expanding its presence to which level of government to enhance grassroots response?',
    'options': { 'A': 'Wards', 'B': 'Local Government Areas (LGAs)', 'C': 'Senatorial Districts', 'D': 'International borders' },
    'ans': 'B',
    'exp': 'Recent mandates have focused on establishing presence in all Local Government Areas to shorten response times.'
  },
  {
    'id': 'F37',
    'subject': 'FIRE_FFS',
    'q': 'What is the FFS primarily trained to deal with on the highways and major roads?',
    'options': { 'A': 'Vehicle registration checks', 'B': 'Accidents involving trapped victims or fire outbreaks (extrication/fire suppression)', 'C': 'Toll collection', 'D': 'Traffic monitoring' },
    'ans': 'B',
    'exp': 'Extrication of accident victims and fire suppression for road traffic incidents are key FFS highway duties.'
  },
  {
    'id': 'F38',
    'subject': 'FIRE_FFS',
    'q': 'The use of breathing apparatus (BA) sets by firemen is primarily due to:',
    'options': { 'A': 'The cold weather', 'B': 'The presence of toxic smoke and oxygen deficiency in burning areas', 'C': 'Preventing dust inhalation', 'D': 'Style and uniform requirements' },
    'ans': 'B',
    'exp': 'BA sets provide clean air for firefighters operating in environments compromised by smoke and combustion products.'
  },
  {
    'id': 'F39',
    'subject': 'FIRE_FFS',
    'q': 'A key piece of equipment carried by FFS fire engines for gaining access is the:',
    'options': { 'A': 'Computer Server', 'B': 'Jaws of Life/Hydraulic Cutter', 'C': 'Fax Machine', 'D': 'Microwave Oven' },
    'ans': 'B',
    'exp': 'The Jaws of Life (or similar hydraulic rescue tools) are critical for extricating victims from vehicles or collapsed structures.'
  },
  {
    'id': 'F40',
    'subject': 'FIRE_FFS',
    'q': 'Which officer rank in the FFS is usually symbolized by the Nigerian coat of arms?',
    'options': { 'A': 'Controller General', 'B': 'Senior Fire Superintendent', 'C': 'Assistant Superintendent of Fire', 'D': 'Fireman I' },
    'ans': 'A',
    'exp': 'The Coat of Arms is the highest insignia, typically reserved for the head of the service, the Controller General.'
  },
  {
    'id': 'F41',
    'subject': 'FIRE_FFS',
    'q': 'The FFS\'s involvement in fire prevention includes the mandatory requirement for businesses to have:',
    'options': { 'A': 'An annual staff party', 'B': 'A comprehensive Fire Safety Certificate', 'C': 'Only armed security guards', 'D': 'High-end surveillance cameras' },
    'ans': 'B',
    'exp': 'Fire Safety Certificates are official approvals from the FFS (or State services) confirming compliance with fire codes.'
  },
  {
    'id': 'F42',
    'subject': 'FIRE_FFS',
    'q': 'Which class of fire involves electrical equipment?',
    'options': { 'A': 'Class A', 'B': 'Class B', 'C': 'Class C', 'D': 'Class D' },
    'ans': 'C',
    'exp': 'Class C fires involve energized electrical equipment.'
  },
  {
    'id': 'F43',
    'subject': 'FIRE_FFS',
    'q': 'The rank of \'Controller General of Fire\' is equivalent to a high-ranking officer in which other agency?',
    'options': { 'A': 'Commissioner of Police', 'B': 'Inspector General of Police (IGP)', 'C': 'Assistant Comptroller General', 'D': 'Brigadier General' },
    'ans': 'B',
    'exp': 'The CG is the highest rank, often considered equivalent to the IGP or heads of other major security services.'
  },
  {
    'id': 'F44',
    'subject': 'FIRE_FFS',
    'q': 'What is the FFS\'s role concerning gas explosions in residential areas?',
    'options': { 'A': 'They ignore it as a police matter', 'B': 'They respond for suppression, search, and rescue', 'C': 'They only offer advice via phone', 'D': 'They only investigate the cause, not rescue' },
    'ans': 'B',
    'exp': 'Gas explosions are high-priority incidents requiring immediate fire suppression and Search and Rescue operations.'
  },
  {
    'id': 'F45',
    'subject': 'FIRE_FFS',
    'q': 'The FFS is currently undergoing reforms to improve its capacity for:',
    'options': { 'A': 'Online banking services', 'B': 'Dealing with chemical, biological, radiological, and nuclear (CBRN) hazards', 'C': 'Running a large farm', 'D': 'International student visa processing' },
    'ans': 'B',
    'exp': 'Modern fire services are expanding capacity to deal with complex, high-hazard incidents like CBRN.'
  },
  {
    'id': 'F46',
    'subject': 'FIRE_FFS',
    'q': 'The term \'Muster Point\' in fire safety refers to the designated location for:',
    'options': { 'A': 'Parking fire trucks', 'B': 'Storing dangerous chemicals', 'C': 'Evacuees to assemble safely after leaving a building', 'D': 'Firefighters to eat lunch' },
    'ans': 'C',
    'exp': 'The muster point is the safe assembly area post-evacuation, used for roll call and accountability.'
  },
  {
    'id': 'F47',
    'subject': 'FIRE_FFS',
    'q': 'What is the primary power source for FFS fire pumps used to deliver water to the fire scene?',
    'options': { 'A': 'Wind power', 'B': 'Internal Combustion Engines (Diesel/Petrol)', 'C': 'Solar panels', 'D': 'Battery packs only' },
    'ans': 'B',
    'exp': 'Fire pumps on trucks are typically powered by high-capacity internal combustion engines for reliable, sustained pressure.'
  },
  {
    'id': 'F48',
    'subject': 'FIRE_FFS',
    'q': 'The FFS works in close collaboration with the State Fire Services, particularly in terms of:',
    'options': { 'A': 'Revenue generation', 'B': 'Operational synergy and mutual aid agreements', 'C': 'Appointing state governors', 'D': 'Setting local market prices' },
    'ans': 'B',
    'exp': 'Collaboration ensures seamless response and the sharing of resources (mutual aid).'
  },
  {
    'id': 'F49',
    'subject': 'FIRE_FFS',
    'q': 'The FFS has been historically challenged by which factor that hinders rapid response?',
    'options': { 'A': 'Abundant water supply', 'B': 'Lack of clear street addressing and traffic congestion', 'C': 'Excessive staff salaries', 'D': 'Too many operational vehicles' },
    'ans': 'B',
    'exp': 'Traffic congestion and poor addressing systems are perennial challenges to emergency response in urban Nigeria.'
  },
  {
    'id': 'F50',
    'subject': 'FIRE_FFS',
    'q': 'What type of fire extinguisher is generally recommended for use in server rooms and sensitive electrical areas?',
    'options': { 'A': 'Water/Foam', 'B': 'Dry Chemical Powder (DCP)', 'C': 'Carbon Dioxide (CO₂) or Clean Agent', 'D': 'Sand' },
    'ans': 'C',
    'exp': 'CO₂ or Clean Agent extinguishers are preferred for electrical and server areas as they leave no residue and do not damage equipment.'
  }
  
// --- ADDED FROM CDCFIB PRACTICE QUESTIONS (Batch 1) ---

// FIRE SERVICE (additional from PDF)
    { id: 'F51', subject: 'FIRE_FFS', q: 'What is the main component of dry chemical powder extinguishers?', options: { A: 'Monoammonium phosphate', B: 'Sodium bicarbonate', C: 'Potassium chloride', D: 'Calcium carbonate' }, ans: 'A', exp: 'Dry chemical powders commonly use monoammonium phosphate as the extinguishing agent.' },
    { id: 'F52', subject: 'FIRE_FFS', q: 'H2O is?', options: { A: 'Water', B: 'Hydrogen peroxide', C: 'Hydroxide', D: 'Hydrogen oxide' }, ans: 'A', exp: 'H2O is the chemical formula for water.' },
    { id: 'F53', subject: 'FIRE_FFS', q: 'Which gas is primarily used in human respiration?', options: { A: 'Oxygen', B: 'Carbon dioxide', C: 'Nitrogen', D: 'Helium' }, ans: 'A', exp: 'Oxygen is the gas humans inhale for respiration.' },
    { id: 'F54', subject: 'FIRE_FFS', q: 'When was the Federal Fire Service (as a unit under Lagos Police Fire Brigade) first started?', options: { A: '1901', B: '1910', C: '1920', D: '1950' }, ans: 'A', exp: 'The service traces its origins to 1901 as part of the Lagos Police Fire Brigade.' },
    { id: 'F55', subject: 'FIRE_FFS', q: 'Class A fires involve which type of materials?', options: { A: 'Ordinary combustibles (wood, paper, cloth)', B: 'Flammable liquids', C: 'Electrical equipment', D: 'Metals' }, ans: 'A', exp: 'Class A fires are ordinary combustible materials such as wood, paper and cloth.' },
    { id: 'F56', subject: 'FIRE_FFS', q: 'Class B fires involve which type of materials?', options: { A: 'Flammable liquids', B: 'Metals', C: 'Paper and wood', D: 'Electrical equipment' }, ans: 'A', exp: 'Class B fires involve flammable liquids.' },
    { id: 'F57', subject: 'FIRE_FFS', q: 'Class C fires involve which type of materials?', options: { A: 'Flammable gases', B: 'Flammable liquids', C: 'Metals', D: 'Paper' }, ans: 'A', exp: 'Class C fires are associated with flammable gases.' },
    { id: 'F58', subject: 'FIRE_FFS', q: 'Class D fires involve which type of materials?', options: { A: 'Combustible metals', B: 'Paper and cloth', C: 'Flammable liquids', D: 'Electrical appliances' }, ans: 'A', exp: 'Class D fires involve combustible metals such as magnesium.' },
    { id: 'F59', subject: 'FIRE_FFS', q: 'What is the emergency phone number for fire in Nigeria (as given in the PDF)?', options: { A: '112', B: '911', C: '999', D: '119' }, ans: 'A', exp: '112 is listed in the practice module as an emergency number for fire.' },

// NSCDC (Nigeria Security and Civil Defence Corps) - appended from PDF
    { id: 'C51', subject: 'CIVIL_DEFENCE_NSCDC', q: 'The Nigeria Security and Civil Defence Corps was first introduced in which year?', options: { A: 'May 1979', B: 'June 1979', C: 'May 1967', D: 'June 1967' }, ans: 'C', exp: 'The practice module indicates May 1967 as the year of introduction.' },
    { id: 'C52', subject: 'CIVIL_DEFENCE_NSCDC', q: 'What inspired the introduction of the NSCDC?', options: { A: 'The Lagos Market Women Protest', B: 'The Nigeria Civil War', C: 'The Aba Market Women Riot', D: 'Civil Unrest across the Country' }, ans: 'B', exp: 'The Nigeria Civil War was cited as the inspiration for the initial formation.' },
    { id: 'C53', subject: 'CIVIL_DEFENCE_NSCDC', q: 'During the Nigeria Civil War, the NSCDC was known as which of the following?', options: { A: 'Lagos Civil Security Commission', B: 'Lagos Security and Community Defense Corps', C: 'Lagos Civil Defense Committee', D: 'Lagos Security and Defense Corporation' }, ans: 'C', exp: 'It was known as the Lagos Civil Defense Committee during that period.' },
    { id: 'C54', subject: 'CIVIL_DEFENCE_NSCDC', q: 'What was the NSCDC’s initial core objective(s)?', options: { A: 'To sensitize and protect the Civil Populace', B: 'To maintain law and order in Civil Society', C: 'To foster movement of people', D: 'To encourage civil society to be peaceful' }, ans: 'A', exp: 'The initial aim was to sensitize and protect the civil populace.' },
    { id: 'C55', subject: 'CIVIL_DEFENCE_NSCDC', q: 'In what year did the former Lagos Civil Defense Committee become officially known as the NSCDC?', options: { A: '1980', B: '1970', C: '1960', D: '1990' }, ans: 'B', exp: 'The module lists 1970 as the year it became officially known as NSCDC.' },
    { id: 'C56', subject: 'CIVIL_DEFENCE_NSCDC', q: 'In what year did NSCDC become a National Security Outfit?', options: { A: '1984', B: '1988', C: '1994', D: '1986' }, ans: 'B', exp: '1988 is given as the year it became a national security outfit.' },
    { id: 'C257', subject: 'CIVIL_DEFENCE_NSCDC', q: 'Who is the Commandant General of NSCDC (as listed)?', options: { A: 'Prof. Attairu Jega', B: 'Dr. Ahmed Abubakar Audi', C: 'Engr. Ali Baba', D: 'Dr. Aliu Maina' }, ans: 'B', exp: 'Dr. Ahmed Abubakar Audi is listed in the practice module.' },
    { id: 'C58', subject: 'CIVIL_DEFENCE_NSCDC', q: 'What is the full meaning of NSCDC?', options: { A: 'Niger Security and Civil Defence Corps', B: 'Nigeria Security and Civil Defense Core', C: 'Nigeria Security and Civil Defence Corps', D: 'Nigeria Civil Defence Organization' }, ans: 'C', exp: 'NSCDC stands for Nigeria Security and Civil Defence Corps.' },
    { id: 'C59', subject: 'CIVIL_DEFENCE_NSCDC', q: 'How many Directorates does NSCDC have?', options: { A: '9', B: '8', C: '7', D: '6' }, ans: 'D', exp: 'The practice questions indicate 6 directorates.' },
    { id: 'C60', subject: 'CIVIL_DEFENCE_NSCDC', q: 'What is the legal document guiding the operations of NSCDC called?', options: { A: 'NSCDC Agenda', B: 'NSCDC Act', C: 'NSCDC Principles', D: 'NSCDC Laws' }, ans: 'B', exp: 'The NSCDC Act is the legal framework guiding the Corps.' },

// NCoS (Correctional Service) - additional entries from PDF
    { id: 'N51', subject: 'CORRECTIONAL_NCS', q: 'What is solitary confinement?', options: { A: 'Keeping an inmate alone in a cell as punishment', B: 'Group rehabilitation program', C: 'Temporary leave from prison', D: 'Open custody arrangement' }, ans: 'A', exp: 'Solitary confinement is the practice of isolating an inmate in a cell.' },
    { id: 'N52', subject: 'CORRECTIONAL_NCS', q: 'Choose the odd one out: (a) Rehabilitation (b) Imprisonment (c) Reformation (d) Endocrine', options: { A: 'Rehabilitation', B: 'Imprisonment', C: 'Reformation', D: 'Endocrine' }, ans: 'D', exp: 'Endocrine is unrelated to correctional service functions.' },
    { id: 'N53', subject: 'CORRECTIONAL_NCS', q: 'Choose the odd one out: (a) Court (b) Prison (c) Teacher (d) Police', options: { A: 'Court', B: 'Prison', C: 'Teacher', D: 'Police' }, ans: 'C', exp: 'Teacher is the odd one out – others are part of the criminal justice system.' },
    { id: 'N54', subject: 'CORRECTIONAL_NCS', q: 'What does NCoS stand for?', options: { A: 'Nigerian Correctional Service', B: 'National Correctional Society', C: 'Nigerian Correctional System', D: 'National Corrections Service' }, ans: 'A', exp: 'NCoS stands for Nigerian Correctional Service.' },
    { id: 'N55', subject: 'CORRECTIONAL_NCS', q: 'Which is the correct title for the head of NCoS?', options: { A: 'Comptroller General', B: 'Controller General', C: 'Commandant General', D: 'Major General' }, ans: 'B', exp: 'The correct title is Controller General.' },

// NIS (Immigration Service) - appended from PDF
    { id: 'I51', subject: 'IMMIGRATION_NIS', q: 'Which of the following is a core duty of the Nigeria Immigration Service (NIS)?', options: { A: 'Persecuting offenders', B: 'Enforcing of laws', C: 'Issuance of all Nigerian travel documents', D: 'Deporting of foreigners' }, ans: 'C', exp: 'Issuance of travel documents (passports) is a core duty of NIS.' },
    { id: 'I52', subject: 'IMMIGRATION_NIS', q: 'The NIS was separated from the Nigerian Police Force in which year?', options: { A: '1946', B: '1956', C: '1958', D: '1964' }, ans: 'C', exp: 'The module lists 1958 as the year NIS was brought out of the police.' },
    { id: 'I53', subject: 'IMMIGRATION_NIS', q: 'The NIS was formally established by an Act of Parliament in which year?', options: { A: '1963', B: '1957', C: '1964', D: '1976' }, ans: 'A', exp: '1963 is listed as the formal establishment year by Act of Parliament.' },
    { id: 'I54', subject: 'IMMIGRATION_NIS', q: 'Which was the first African country to introduce an e-passport (as listed)?', options: { A: 'South Africa', B: 'Ghana', C: 'Liberia', D: 'Nigeria' }, ans: 'D', exp: 'Nigeria is listed in the practice module as the first African country to introduce e-passport.' },
    { id: 'I55', subject: 'IMMIGRATION_NIS', q: 'How many Comptroller Generals has NIS had (as given)?', options: { A: '10', B: '12', C: '8', D: '15' }, ans: 'A', exp: 'The module lists 10 Comptroller Generals since inception.' },
    { id: 'I56', subject: 'IMMIGRATION_NIS', q: 'Who is listed as the present Comptroller General of NIS in the PDF?', options: { A: 'Umar Dahiru', B: 'David Parradang', C: 'Boniface Cosmos', D: 'Kemi Nandap' }, ans: 'D', exp: 'Kemi Nandap is listed as the present Comptroller General in the sample.' },
    { id: 'I57', subject: 'IMMIGRATION_NIS', q: 'Which title is correct for the head of NIS?', options: { A: 'Comptroller General', B: 'Controller General', C: 'Commandant General', D: 'Major General' }, ans: 'A', exp: 'The head of NIS holds the title Comptroller General.' },
    { id: 'I58', subject: 'IMMIGRATION_NIS', q: 'How many Directorates does NIS have (as listed)?', options: { A: '10', B: '8', C: '7', D: '9' }, ans: 'A', exp: 'The module indicates 10 directorates.' },
    { id: 'I59', subject: 'IMMIGRATION_NIS', q: 'What does CGIS stand for?', options: { A: 'Comptroller General of Immigration Service', B: 'Central Government Immigration Service', C: 'Comprehensive Government Immigration System', D: 'Complainant General Immigration Service' }, ans: 'A', exp: 'CGIS is an abbreviation for Comptroller General of Immigration Service.' },
    { id: 'I60', subject: 'IMMIGRATION_NIS', q: 'NIS is under which Ministry?', options: { A: 'Ministry of Defence', B: 'Ministry of Foreign Affairs', C: 'Ministry of Interior', D: 'Ministry of Justice' }, ans: 'C', exp: 'NIS operates under the Ministry of Interior.' },

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
