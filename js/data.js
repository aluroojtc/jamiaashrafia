/**
 * JAMIA ASHRAFIA LAHORE - CLOUD LMS DATA STORE
 * Authentic Institutional Seed Data & LocalStorage Persistence Engine
 * History Source: Wikipedia & Institutional Archives (Est. 1947 by Mufti Muhammad Hassan)
 */

const STORAGE_KEY = 'JAMIA_ASHRAFIA_LMS_DATA_V1';

// Global Comprehensive World Countries List for International Student Admissions
const WORLD_COUNTRIES = [
    "Afghanistan", "Albania", "Algeria", "Argentina", "Australia", "Austria", "Azerbaijan",
    "Bahrain", "Bangladesh", "Belgium", "Bosnia and Herzegovina", "Brazil", "Brunei", "Bulgaria",
    "Canada", "China", "Cyprus", "Czech Republic", "Denmark", "Egypt", "Fiji", "Finland",
    "France", "Georgia", "Germany", "Ghana", "Greece", "Hong Kong", "Hungary", "India",
    "Indonesia", "Iran", "Iraq", "Ireland", "Italy", "Japan", "Jordan", "Kazakhstan",
    "Kenya", "Kuwait", "Kyrgyzstan", "Lebanon", "Libya", "Malaysia", "Maldives", "Mauritius",
    "Mexico", "Morocco", "Nepal", "Netherlands", "New Zealand", "Nigeria", "Norway", "Oman",
    "Pakistan", "Palestine", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia",
    "Saudi Arabia", "Singapore", "Somalia", "South Africa", "South Korea", "Spain", "Sri Lanka",
    "Sudan", "Sweden", "Switzerland", "Syria", "Tajikistan", "Tanzania", "Thailand", "Tunisia",
    "Turkey", "Turkmenistan", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom",
    "United States", "Uzbekistan", "Yemen", "Zambia", "Zimbabwe"
];
window.WORLD_COUNTRIES = WORLD_COUNTRIES;

const INITIAL_DATA = {
    institution: {
        name: "Jamia Ashrafia Lahore",
        arabicName: "الجامعة الأشرفية، لاهور",
        urduName: "جامعہ اشرفیہ، لاہور",
        motto: "علم اور تقویٰ (Knowledge & Piety)",
        established: 1947,
        founder: "Hazrat Maulana Mufti Muhammad Hassan Amritsari (رحمة الله عليه)",
        namedAfter: "Hakim al-Ummah Hazrat Maulana Ashraf Ali Thanwi (رحمة الله عليه)",
        mainCampus: "Canal Road & Ferozepur Road, Muslim Town, Lahore",
        area: "120 Kanals",
        website: "https://jamiaashrafia.org",
        affiliation: "Wifaq-ul-Madaris Al-Arabia Pakistan",
        hospital: "Ashrafia Free Charitable Hospital",
        currentLeadership: {
            principal: "Maulana Fazl-ur-Raheem Ashrafi",
            vicePrincipal: "Maulana Hafiz Ajwad Ubaid",
            headOfHadith: "Qari Arshad Ubaid",
            chiefMufti: "Mufti Ahmadur Rahman"
        },
        branches: [
            { id: "b1", code: "MAIN", name: "Main Campus (Central Headquarters & Dawra-e-Hadith)", location: "Ferozepur Road, Lahore", isWomens: false, established: 1955, students: 1450 },
            { id: "b2", code: "MFB", name: "Madrisatul Faisal Lil Bannat (Premier Women's Campus)", location: "Model Town, Lahore", isWomens: true, established: 1978, students: 850 },
            { id: "b3", code: "ANAR", name: "Madrisa Ashrafia (Historic Founding Building)", location: "Nila Gumbad, Old Anarkali, Lahore", isWomens: false, established: 1947, students: 300 },
            { id: "b4", code: "MQB", name: "Mahad al-Quba", location: "Johar Town, Lahore", isWomens: false, established: 1994, students: 420 },
            { id: "b5", code: "MBQ", name: "Madrisa Baitul Quran", location: "Samanabad, Lahore", isWomens: false, established: 1985, students: 280 },
            { id: "b6", code: "IBA", name: "Iqra Badrul Atfaal", location: "Allama Iqbal Town, Lahore", isWomens: false, established: 1999, students: 350 },
            { id: "b7", code: "AMK", name: "Ahsanul Makatib", location: "Gujjar Pura, Lahore", isWomens: false, established: 1991, students: 210 },
            { id: "b8", code: "MHB", name: "Madrisatul Hassan", location: "Bedian Road, Lahore", isWomens: false, established: 2004, students: 310 },
            { id: "b9", code: "MSQ", name: "Madrisa Sadiq", location: "Raiwind Road, Lahore", isWomens: false, established: 2008, students: 260 },
            { id: "b10", code: "MAB", name: "Madrisa Ashrafia lil Bannat", location: "Garden Town, Lahore", isWomens: true, established: 2002, students: 400 },
            { id: "b11", code: "ABZ", name: "Madrisa Abdullah bin Zubair", location: "Gulshan-e-Ravi, Lahore", isWomens: false, established: 2011, students: 240 },
            { id: "b12", code: "MHA", name: "Madrisatul Hassan (Regional Branch)", location: "Hassan Abdal, Rawalpindi District", isWomens: false, established: 1996, students: 380 }
        ]
    },

    prayerTimes: {
        fajr: "04:45 AM",
        sunrise: "06:05 AM",
        zuhr: "12:15 PM",
        asr: "04:30 PM",
        maghrib: "06:10 PM",
        isha: "07:45 PM",
        currentActive: "zuhr"
    },

    roles: [
        {
            id: "SUPER_ADMIN",
            name: "Super Admin (Mohtamim)",
            urduTitle: "حضرت مہتمم / مجلس شوریٰ",
            badgeClass: "gold",
            description: "Full root administrative control over all LMS branches, faculty, scholars, exams, and financial accounts.",
            isSystem: true,
            permissions: ["*"],
            status: "ACTIVE"
        },
        {
            id: "ACADEMIC_ADMIN",
            name: "Admin",
            urduTitle: "ناظم تعلیمات",
            badgeClass: "info",
            description: "Administrative oversight of admissions, class allocations, syllabus, timetables, and academic rosters.",
            isSystem: true,
            permissions: ["admissions:manage", "classes:manage", "timetable:manage", "exams:manage"],
            status: "ACTIVE"
        },
        {
            id: "TEACHER",
            name: "Teacher (Sheikh-ul-Hadith)",
            urduTitle: "استاذ / شیخ الحدیث",
            badgeClass: "success",
            description: "Faculty access for assigned kitabs, live Zoom dars streaming, assignment grading, and attendance marking.",
            isSystem: true,
            permissions: ["classes:view_assigned", "attendance:mark", "assignments:grade", "virtual_class:host"],
            status: "ACTIVE"
        },
        {
            id: "STUDENT",
            name: "Student (Talib-e-Ilm)",
            urduTitle: "طالب علم",
            badgeClass: "primary",
            description: "Scholar access for daily academic dars, check-in attendance widget, homework submissions, and sanad results.",
            isSystem: true,
            permissions: ["classes:view_enrolled", "assignments:submit", "exams:submit", "attendance:checkin"],
            status: "ACTIVE"
        },
        {
            id: "ACCOUNTANT",
            name: "Accountant / Donor",
            urduTitle: "ناظم مالیات و صدقات",
            badgeClass: "warning",
            description: "Management of tuition fee challans, student fee concessions, and Jamia Ashrafia Zakat / Sadqah records.",
            isSystem: false,
            permissions: ["fees:manage", "challan:generate", "donations:record"],
            status: "ACTIVE"
        }
    ],

    users: [
        {
            id: "u_admin",
            name: "Maulana Fazl-ur-Raheem Ashrafi",
            urduName: "حضرت مولانا فضل الرحیم اشرفی",
            role: "SUPER_ADMIN",
            designation: "Principal / Mohtamim",
            email: "mohtamim@jamiaashrafia.org",
            status: "ACTIVE",
            branchId: "b1",
            avatar: "FR"
        },
        {
            id: "u_nazim",
            name: "Maulana Hafiz Ajwad Ubaid",
            urduName: "مولانا حافظ اجود عبید",
            role: "ACADEMIC_ADMIN",
            designation: "Nazim-e-Taleemat (Director Academics)",
            email: "taleemat@jamiaashrafia.org",
            status: "ACTIVE",
            branchId: "b1",
            avatar: "AU"
        },
        {
            id: "u_teacher_1",
            name: "Qari Arshad Ubaid",
            urduName: "قاری ارشد عبید",
            role: "TEACHER",
            designation: "Sheikh-ul-Hadith & Sadr Muallim",
            specialization: "Sahih al-Bukhari & Ulum-ul-Hadith",
            email: "arshad.ubaid@jamiaashrafia.org",
            branchId: "b1",
            avatar: "AO",
            sanad: "Shahadat-ul-Alimiyyah (Wifaq)",
            status: "ACTIVE",
            assignedCourses: ["c_bukhari_1", "c_tirmidhi", "c_tajweed"]
        },
        {
            id: "u_teacher_2",
            name: "Mufti Ahmadur Rahman",
            urduName: "مفتی احمد الرحمن",
            role: "TEACHER",
            designation: "Chief Mufti, Darul Ifta",
            specialization: "Islamic Jurisprudence (Fiqh & Fatwa)",
            email: "darulifta@jamiaashrafia.org",
            branchId: "b1",
            avatar: "AR",
            sanad: "Takhassus fil-Ifta (Jamia Ashrafia)",
            status: "ACTIVE",
            assignedCourses: ["c_hidayah", "c_banking"]
        },
        {
            id: "u_student_1",
            name: "Muhammad Talha Usmani",
            urduName: "محمد طلحہ عثمانی",
            role: "STUDENT",
            rollNo: "ASH-2024-001",
            classId: "cls_dawra_a",
            program: "Dars-e-Nizami (Dawra-e-Hadith)",
            branchId: "b1",
            email: "talha.usmani@student.ashrafia.org",
            phone: "+92 301 5550101",
            guardianName: "Maulana Shabbir Ahmad Usmani",
            enrollmentDate: "2024-08-15",
            hostel: "Hostel Block A, Room 204",
            attendancePct: 98.4,
            gpa: "Mumtaz (88%)",
            status: "ACTIVE",
            avatar: "TU"
        },
        {
            id: "u_student_2",
            name: "Hafiz Usman Tariq",
            urduName: "حافظ عثمان طارق",
            role: "STUDENT",
            rollNo: "ASH-2024-042",
            classId: "cls_aaliyah",
            program: "Dars-e-Nizami (Aaliyah 1st Year)",
            branchId: "b1",
            email: "usman.tariq@student.ashrafia.org",
            phone: "+92 321 5550142",
            guardianName: "Tariq Mahmood",
            enrollmentDate: "2024-08-20",
            hostel: "Day Scholar",
            attendancePct: 94.2,
            gpa: "Jayyid Jiddan (76%)",
            status: "ACTIVE",
            avatar: "UT"
        },
        {
            id: "u_student_3",
            name: "Abdul Rehman Farooqi",
            urduName: "عبد الرحمن فاروقی",
            role: "STUDENT",
            rollNo: "ASH-2024-008",
            classId: "cls_ifta",
            program: "Takhassus fil-Fiqh wal-Ifta",
            branchId: "b1",
            email: "rehman.farooqi@student.ashrafia.org",
            phone: "+92 333 5550108",
            guardianName: "Mufti Abdul Quddus",
            enrollmentDate: "2023-09-01",
            hostel: "Hostel Block C, Room 102",
            attendancePct: 100.0,
            gpa: "Mumtaz (92%)",
            status: "ACTIVE",
            avatar: "RF"
        },
        {
            id: "u_student_4",
            name: "Zaid bin Harith",
            urduName: "زید بن حارث",
            role: "STUDENT",
            rollNo: "ASH-2024-115",
            classId: "cls_hifz",
            program: "Hifz-ul-Quran & Tajweed",
            branchId: "b3",
            email: "zaid.harith@student.ashrafia.org",
            phone: "+92 345 5550115",
            guardianName: "Harith bin Abdullah",
            enrollmentDate: "2024-01-10",
            hostel: "Anarkali Campus Boarding",
            attendancePct: 91.5,
            gpa: "Jayyid (68%)",
            status: "ACTIVE",
            avatar: "ZH"
        },
        {
            id: "u_student_5",
            name: "Bilal Ahmed Qureshi",
            urduName: "بلال احمد قریشی",
            role: "STUDENT",
            rollNo: "ASH-2024-073",
            classId: "cls_qiraat",
            program: "Qira'at Sab'ah and Asharah",
            branchId: "b4",
            email: "bilal.qureshi@student.ashrafia.org",
            phone: "+92 300 5550173",
            guardianName: "Ahmed Qureshi",
            enrollmentDate: "2024-08-15",
            hostel: "Day Scholar",
            attendancePct: 96.0,
            gpa: "Mumtaz (85%)",
            status: "ACTIVE",
            avatar: "BQ"
        },
        {
            id: "u_student_6",
            name: "Zubair Masood",
            urduName: "زبیر مسعود",
            role: "STUDENT",
            rollNo: "ASH-2024-019",
            classId: "cls_dawra_a",
            program: "Dars-e-Nizami (Dawra-e-Hadith)",
            branchId: "b1",
            email: "zubair.masood@student.ashrafia.org",
            phone: "+92 312 5550119",
            guardianName: "Masood Akhtar",
            enrollmentDate: "2024-08-15",
            hostel: "Hostel Block A, Room 210",
            attendancePct: 88.0,
            gpa: "Jayyid (64%)",
            status: "ACTIVE",
            avatar: "ZM"
        },
        {
            id: "u_student_7",
            name: "Maryam Siddiqah",
            urduName: "مریم صدیقہ",
            role: "STUDENT",
            rollNo: "ASH-2024-301",
            classId: "cls_women_alim",
            program: "Alimiyyah for Women (Lil Bannat)",
            branchId: "b2",
            email: "maryam.siddiqah@student.ashrafia.org",
            phone: "+92 322 5550301",
            guardianName: "Hafiz Muhammad Siddiq",
            enrollmentDate: "2024-08-22",
            hostel: "Model Town Girls Hostel",
            attendancePct: 97.5,
            gpa: "Mumtaz (89%)",
            status: "ACTIVE",
            avatar: "MS"
        },
        {
            id: "u_student_8",
            name: "Hamza Noor",
            urduName: "حمزہ نور",
            role: "STUDENT",
            rollNo: "ASH-2024-094",
            classId: "cls_dawra_b",
            program: "Dars-e-Nizami (Dawra-e-Hadith)",
            branchId: "b1",
            email: "hamza.noor@student.ashrafia.org",
            phone: "+92 305 5550094",
            guardianName: "Noor Muhammad",
            enrollmentDate: "2024-08-15",
            hostel: "Hostel Block B, Room 105",
            attendancePct: 93.0,
            gpa: "Jayyid Jiddan (74%)",
            status: "ACTIVE",
            avatar: "HN"
        },
        {
            id: "u_accountant",
            name: "Haji Abdul Ghaffar",
            urduName: "حاجی عبد الغفار",
            role: "ACCOUNTANT",
            designation: "Nazim-e-Maliyat (Finance & Zakat Officer)",
            email: "finance@jamiaashrafia.org",
            status: "ACTIVE",
            branchId: "b1",
            avatar: "AG"
        }
    ],

    programs: [
        { id: "p1", code: "DN-8", name: "Dars-e-Nizami (Shahadat-ul-Alimiyyah)", urdu: "درس نظامی (شہادۃ العالمیہ)", years: 8, wifaqEquivalence: "Recognized as M.A Islamic Studies / Arabic by HEC", branches: ["b1", "b2", "b3"] },
        { id: "p2", code: "TKH-IFTA", name: "Takhassus fil-Fiqh wal-Ifta (Postgraduate)", urdu: "تخصص فی الفقہ والافتاء", years: 2, wifaqEquivalence: "M.Phil / Research in Islamic Law & Fatwa", branches: ["b1"] },
        { id: "p3", code: "HIFZ", name: "Hifz-ul-Quran & Tajweed", urdu: "حفظ القرآن مع تجوید", years: 3, wifaqEquivalence: "Certificate in Quran Memorization", branches: ["b1", "b3", "b4", "b5", "b6"] },
        { id: "p4", code: "QIR-10", name: "Qira'at Sab'ah and Asharah", urdu: "قرأت سبعہ و عشرہ", years: 2, wifaqEquivalence: "Advanced Tajweed & Modes of Recitation", branches: ["b1", "b4"] },
        { id: "p5", code: "DN-WOMEN", name: "Alimiyyah for Women (Lil Bannat)", urdu: "عالمیہ برائے طالبات (للبنات)", years: 6, wifaqEquivalence: "B.A / M.A Islamic Studies", branches: ["b2", "b10"] }
    ],

    courses: [
        {
            id: "c_bukhari_1",
            code: "HAD-801",
            title: "Sahih al-Bukhari (Jild 1 - Kitab al-Iman, Ilm, Salah)",
            urduTitle: "صحیح البخاری (جلد اول)",
            kitabAuthor: "Imam Abu Abdullah Muhammad ibn Ismail al-Bukhari (رحمه الله)",
            programId: "p1",
            year: 8,
            credits: 6,
            recommendedPub: "Maktaba Ashrafia / Darul Kutub al-Ilmiyyah"
        },
        {
            id: "c_tirmidhi",
            code: "HAD-803",
            title: "Jami' at-Tirmidhi (Abwab al-Buyu & Ahkam)",
            urduTitle: "جامع الترمذی",
            kitabAuthor: "Imam Abu Isa Muhammad ibn Isa at-Tirmidhi (رحمه الله)",
            programId: "p1",
            year: 8,
            credits: 5,
            recommendedPub: "Maktaba Ashrafia Lahore"
        },
        {
            id: "c_hidayah",
            code: "FQH-701",
            title: "Al-Hidayah (Fi Fiqh al-Imam al-Azam Abu Hanifah)",
            urduTitle: "الہدایہ فی الفقہ الحنفی",
            kitabAuthor: "Allama Burhan al-Din al-Marghinani (رحمه الله)",
            programId: "p1",
            year: 7,
            credits: 5,
            recommendedPub: "Maktaba Ashrafia / Dar al-Salam"
        },
        {
            id: "c_banking",
            code: "IFTA-902",
            title: "Contemporary Islamic Banking & Fiqh al-Muamalat",
            urduTitle: "فقہ المعاملات اور اسلامی بینکاری",
            kitabAuthor: "Majlis-e-Tehqiqat Jamia Ashrafia",
            programId: "p2",
            year: 1,
            credits: 4,
            recommendedPub: "Maktaba Ashrafia Research Wing"
        },
        {
            id: "c_tajweed",
            code: "TAJ-101",
            title: "Al-Jazariyyah & Ahkam at-Tajweed",
            urduTitle: "المقدمة الجزریة فی التجوید",
            kitabAuthor: "Imam Ibn al-Jazari (رحمه الله)",
            programId: "p3",
            year: 1,
            credits: 3,
            recommendedPub: "Idarah Ashrafia"
        }
    ],

    classes: [
        { id: "cls_dawra_a", name: "Dawra-e-Hadith (Alimiyyah Final)", section: "Section A (Hall Imam Bukhari)", programId: "p1", branchId: "b1", room: "Hall Imam Bukhari", capacity: 70, teacherId: "u_teacher_1", courseTeachers: [{ courseId: "c_bukhari_1", teacherId: "u_teacher_1" }, { courseId: "c_tirmidhi", teacherId: "u_teacher_1" }] },
        { id: "cls_dawra_b", name: "Dawra-e-Hadith (Alimiyyah Final)", section: "Section B (Hall Imam Muslim)", programId: "p1", branchId: "b1", room: "Hall Imam Muslim", capacity: 70, teacherId: "u_teacher_1", courseTeachers: [{ courseId: "c_bukhari_1", teacherId: "u_teacher_1" }, { courseId: "c_tirmidhi", teacherId: "u_teacher_1" }] },
        { id: "cls_aaliyah", name: "Aaliyah (7th Year)", section: "Section A", programId: "p1", branchId: "b1", room: "Room 201", capacity: 55, teacherId: "u_teacher_2", courseTeachers: [{ courseId: "c_hidayah", teacherId: "u_teacher_2" }] },
        { id: "cls_ifta", name: "Takhassus fil-Ifta (1st Year)", section: "Darul Ifta Seminar Room", programId: "p2", branchId: "b1", room: "Darul Ifta Conference Room", capacity: 25, teacherId: "u_teacher_2", courseTeachers: [{ courseId: "c_banking", teacherId: "u_teacher_2" }] },
        { id: "cls_hifz_3", name: "Hifz-ul-Quran (Daur-e-Kamil)", section: "Room 102", programId: "p3", branchId: "b1", room: "Room 102", capacity: 30, teacherId: "u_teacher_1", courseTeachers: [{ courseId: "c_tajweed", teacherId: "u_teacher_1" }] },
        { id: "cls_hifz", name: "Hifz-ul-Quran & Tajweed", section: "Anarkali Campus", programId: "p3", branchId: "b3", room: "Anarkali Hifz Hall", capacity: 40, teacherId: "u_teacher_1", courseTeachers: [{ courseId: "c_tajweed", teacherId: "u_teacher_1" }] },
        { id: "cls_qiraat", name: "Qira'at Sab'ah and Asharah", section: "Mahad al-Quba", programId: "p4", branchId: "b4", room: "Qira'at Hall", capacity: 30, teacherId: "u_teacher_1", courseTeachers: [{ courseId: "c_tajweed", teacherId: "u_teacher_1" }] },
        { id: "cls_women_alim", name: "Alimiyyah for Women (Lil Bannat)", section: "Model Town Campus", programId: "p5", branchId: "b2", room: "Lil Bannat Hall 1", capacity: 60, teacherId: "u_teacher_2", courseTeachers: [{ courseId: "c_hidayah", teacherId: "u_teacher_2" }] }
    ],

    courseMaterials: [],

    admissions: [
        {
            id: "adm_101",
            applicationNo: "ASH-ADM-2024-089",
            studentType: "LOCAL",
            name: "Ahmad Raza Siddiqui",
            fatherName: "Maulana Muhammad Siddique",
            cnic: "35201-8934521-3",
            passport: "",
            country: "Pakistan",
            phone: "+92 300 4589211",
            email: "ahmad.raza@gmail.com",
            programId: "p1",
            branchId: "b1",
            hostelRequired: true,
            previousMadrasa: "Jamia Farooqia Karachi (Sanawiyyah Passed)",
            hafizStatus: true,
            status: "INTERVIEW_SCHEDULED",
            interviewDate: "2026-10-05 10:00 AM",
            interviewScore: null,
            allottedRollNo: null,
            appliedAt: "2026-09-24"
        },
        {
            id: "adm_102",
            applicationNo: "ASH-ADM-2024-090",
            studentType: "LOCAL",
            name: "Zubair Ahmad Qasmi",
            fatherName: "Hafiz Abdul Qadir",
            cnic: "38403-1249872-5",
            passport: "",
            country: "Pakistan",
            phone: "+92 321 7845123",
            email: "zubair.qasmi@outlook.com",
            programId: "p2",
            branchId: "b1",
            hostelRequired: true,
            previousMadrasa: "Jamia Ashrafia Lahore (Dawra-e-Hadith Mumtaz)",
            hafizStatus: true,
            status: "APPROVED",
            interviewDate: "2026-09-20 11:30 AM",
            interviewScore: 94.5,
            allottedRollNo: "ASH-IFT-018",
            appliedAt: "2026-09-18"
        },
        {
            id: "adm_103",
            applicationNo: "ASH-ADM-2024-091",
            studentType: "LOCAL",
            name: "Zainab Bint Tariq",
            fatherName: "Tariq Mahmood",
            cnic: "35202-6721980-6",
            passport: "",
            country: "Pakistan",
            phone: "+92 333 9812470",
            email: "zainab.tariq@gmail.com",
            programId: "p5",
            branchId: "b2",
            hostelRequired: false,
            previousMadrasa: "Madrisatul Faisal Lil Bannat Model Town",
            hafizStatus: true,
            status: "ENROLLED",
            interviewDate: "2026-09-15",
            interviewScore: 91.0,
            allottedRollNo: "ASH-B-114",
            appliedAt: "2026-09-12"
        },
        {
            id: "adm_104",
            applicationNo: "ASH-ADM-2024-092",
            studentType: "LOCAL",
            name: "Abdullah Haroon",
            fatherName: "Haroon Rashid",
            cnic: "37405-5544123-1",
            passport: "",
            country: "Pakistan",
            phone: "+92 301 6677889",
            email: "abdullah.haroon@yahoo.com",
            programId: "p3",
            branchId: "b4",
            hostelRequired: false,
            previousMadrasa: "Government High School Lahore",
            hafizStatus: false,
            status: "UNDER_REVIEW",
            interviewDate: null,
            interviewScore: null,
            allottedRollNo: null,
            appliedAt: "2026-09-27"
        },
        {
            id: "adm_105",
            applicationNo: "ASH-ADM-2024-093",
            studentType: "INTERNATIONAL",
            name: "Tariq Abdul Majeed",
            fatherName: "Maulana Abdul Majeed",
            cnic: "",
            passport: "GBR-98421054",
            country: "United Kingdom",
            phone: "+44 7700 900123",
            email: "tariq.majeed@gmail.com",
            programId: "p1",
            branchId: "b1",
            hostelRequired: true,
            previousMadrasa: "Darul Uloom London",
            hafizStatus: true,
            status: "APPLIED",
            interviewDate: null,
            interviewScore: null,
            allottedRollNo: null,
            appliedAt: "2026-09-28"
        }
    ],

    assignments: [
        {
            id: "asg_1",
            classId: "cls_dawra_a",
            courseId: "c_bukhari_1",
            teacherId: "u_teacher_1",
            title: "Tahqiq & Takhrij: Hadith Innamal A'malu bin-Niyyat",
            urduTitle: "تحقیق و تخریج حدیث انما الاعمال بالنیات",
            description: "Provide complete Sanad analysis, translation of Gharib al-Hadith phrases, and extract 7 fundamental legal principles derived by Imam Bukhari and Allama Ibn Hajar in Fath al-Bari.",
            dueDate: "2026-10-08",
            maxMarks: 50,
            createdAt: "2026-09-25"
        },
        {
            id: "asg_2",
            classId: "cls_ifta",
            courseId: "c_banking",
            teacherId: "u_teacher_2",
            title: "Shariah Analysis of Murabaha vs. Conventional Interest-Based Financing",
            urduTitle: "مرابحہ اور سودی تمویل میں شرعی فرق و تقابل",
            description: "Draft a formal Fatwa review on Diminishing Musharakah utilized in Islamic home financing with primary citations from Badai' as-Sana'i and contemporary AAOIFI standards.",
            dueDate: "2026-10-12",
            maxMarks: 100,
            createdAt: "2026-09-26"
        }
    ],

    assignmentSubmissions: [
        {
            id: "sub_1",
            assignmentId: "asg_1",
            studentId: "u_student_1",
            studentName: "Muhammad Talha Usmani",
            rollNo: "ASH-2024-001",
            submissionText: "الحمد لله رب العالمين... The Hadith of Niyyah forms a third of all Islamic jurisprudence as noted by Imam ash-Shafi'i. The narrator Yahya ibn Sa'id al-Ansari is Thiqah Thabit, transmitting from Muhammad ibn Ibrahim at-Taymi from Alqama from Umar ibn al-Khattab (RA). Seven primary rulings derived: 1. Niyyah is a Rukn in prayer and fast; 2. Sincerity determines the reward; 3. Hijrah for worldly gain is legally valid but spiritually devoid of sacred virtue...",
            attachments: [],
            submittedAt: "2026-10-02T16:30:00.000Z",
            isGraded: true,
            marksObtained: 48,
            wifaqGrade: "MUMTAZ",
            gradedBy: "u_teacher_1",
            gradedAt: "2026-10-03T09:00:00.000Z",
            feedback: "Mumtaz! Thorough takhrij with exceptional references to Fath al-Bari and Umdat al-Qari. Baraka Allahu feek."
        }
    ],

    exams: [
        {
            id: "ex_1",
            title: "Shashmahi Examination 1446 AH: Sahih al-Bukhari",
            urduTitle: "امتحان ششماہی: صحیح البخاری",
            examType: "SHASHMAHI_MIDTERM",
            mode: "ONLINE",
            status: "SCHEDULED",
            classId: "cls_dawra_a",
            courseId: "c_bukhari_1",
            examDate: "2026-10-15",
            startTime: "08:30",
            durationMinutes: 180,
            totalMarks: 60,
            passingMarks: 24,
            createdBy: "u_teacher_1",
            resultsPublished: false,
            session: "1446-1447 AH / 2026-2027 CE",
            questions: [
                { id: "q1", type: "WRITTEN", marks: 20, text: "ترجم العبارة الآتية ترجمة سديدة مع ضبط الحركات وتخريج المسائل الفقهية المتعلقة بالنية في العبادات." },
                { id: "q2", type: "WRITTEN", marks: 20, text: "وضح منهج الإمام البخاري في إيراد التراجم الخفية والظاهرة مستدلاً بباب كتاب الإيمان." },
                { id: "q3", type: "WRITTEN", marks: 20, text: "ترجم لثلاثة من رجال السند الآتي: الحميدي، سفيان بن عيينة، يحيى بن سعيد الأنصاري." }
            ]
        },
        {
            id: "ex_2",
            title: "Annual Board Mock Examination: Al-Hidayah",
            urduTitle: "امتحان سالانہ: الہدایہ شریف",
            examType: "SALANA_FINAL",
            mode: "OFFLINE",
            status: "SCHEDULED",
            classId: "cls_aaliyah",
            courseId: "c_hidayah",
            examDate: "2026-10-18",
            startTime: "08:30",
            durationMinutes: 180,
            totalMarks: 100,
            passingMarks: 40,
            createdBy: "u_teacher_2",
            resultsPublished: true,
            session: "1446-1447 AH / 2026-2027 CE",
            questions: []
        },
        {
            id: "ex_3",
            title: "Weekly Online Quiz: Usul al-Hadith",
            urduTitle: "ہفتہ وار آن لائن کوئز: اصول الحدیث",
            examType: "WEEKLY_QUIZ",
            mode: "ONLINE",
            status: "OPEN",
            classId: "cls_dawra_a",
            courseId: "c_bukhari_1",
            examDate: "2026-10-03",
            startTime: "09:00",
            durationMinutes: 30,
            totalMarks: 20,
            passingMarks: 8,
            createdBy: "u_teacher_1",
            resultsPublished: false,
            session: "1446-1447 AH / 2026-2027 CE",
            questions: [
                { id: "q1", type: "MCQ", marks: 5, text: "What is the first Hadith in Sahih al-Bukhari?", options: ["Hadith of Jibril", "Innamal A'malu bin-Niyyat", "Hadith of Ihsan", "Hadith of the Ten Promised Paradise"], correctIndex: 1 },
                { id: "q2", type: "MCQ", marks: 5, text: "A Hadith whose chain is connected with trustworthy, precise narrators and free of hidden defects is called:", options: ["Hasan", "Da'if", "Sahih", "Mawdu'"], correctIndex: 2 },
                { id: "q3", type: "WRITTEN", marks: 10, text: "Briefly explain the difference between Mutawatir and Ahad narrations with one example of each." }
            ]
        }
    ],

    examSubmissions: [],

    examResults: [
        {
            id: "res_1",
            examId: "ex_1",
            studentId: "u_student_1",
            studentName: "Muhammad Talha Usmani",
            rollNo: "ASH-2024-001",
            marksObtained: 52,
            totalMarks: 60,
            published: false,
            wifaqGrade: "MUMTAZ",
            urduGrade: "ممتاز (Excellent)",
            examinerRemarks: "Exceptional mastery of I'rab, Asma-ur-Rijal, and jurisprudential extraction.",
            sanadNumber: "ASH-SANAD-1446-0982"
        },
        {
            id: "res_2",
            examId: "ex_2",
            studentId: "u_student_2",
            studentName: "Hafiz Usman Tariq",
            rollNo: "ASH-2024-042",
            marksObtained: 84.0,
            totalMarks: 100,
            published: true,
            wifaqGrade: "MUMTAZ",
            urduGrade: "ممتاز (Excellent)",
            examinerRemarks: "Sound logical deduction with strong Hanafi Usul grounding.",
            sanadNumber: "ASH-SANAD-1446-1044"
        }
    ],

    feeStructures: [
        { id: "fs_p1", programId: "p1", name: "Dars-e-Nizami Fee Structure", registrationFee: 1000, admissionFee: 5000, monthlyTuition: 0, hostelFee: 3500, messFee: 3000, examFee: 1500, notes: "Tuition is free (Waqf). Hostel & mess charged to boarders only." },
        { id: "fs_p2", programId: "p2", name: "Takhassus fil-Ifta Fee Structure", registrationFee: 1000, admissionFee: 6000, monthlyTuition: 0, hostelFee: 3500, messFee: 3000, examFee: 2000, notes: "Deserving scholars may apply for a full waiver." },
        { id: "fs_p3", programId: "p3", name: "Hifz-ul-Quran Fee Structure", registrationFee: 500, admissionFee: 2000, monthlyTuition: 0, hostelFee: 3000, messFee: 2500, examFee: 1000, notes: "" },
        { id: "fs_p4", programId: "p4", name: "Qira'at Fee Structure", registrationFee: 500, admissionFee: 3000, monthlyTuition: 0, hostelFee: 3000, messFee: 2500, examFee: 1000, notes: "" },
        { id: "fs_p5", programId: "p5", name: "Alimiyyah Lil Bannat Fee Structure", registrationFee: 1000, admissionFee: 4000, monthlyTuition: 0, hostelFee: 3500, messFee: 3000, examFee: 1500, notes: "Day scholars pay transport separately." }
    ],

    feeChallans: [
        {
            id: "ch_1",
            challanNumber: "CH-ASH-2024-10081",
            studentId: "u_student_1",
            studentName: "Muhammad Talha Usmani",
            rollNo: "ASH-2024-001",
            class: "Dawra-e-Hadith (Sec A)",
            billingMonth: "Safar - Rabi-ul-Awwal 1446",
            dueDate: "2026-10-10",
            tuitionFee: 0,
            hostelMessFee: 6500,
            examFee: 1500,
            scholarshipWaiver: 6500, // 100% Yateem/Mustahiq Madrasa Kafalat
            netPayable: 1500,
            feeType: "MONTHLY",
            status: "PAID",
            paidAt: "2026-10-01",
            bankRef: "HBL-PK-789012456"
        },
        {
            id: "ch_2",
            challanNumber: "CH-ASH-2024-10082",
            studentId: "u_student_2",
            studentName: "Hafiz Usman Tariq",
            rollNo: "ASH-2024-042",
            class: "Aaliyah (7th Year)",
            billingMonth: "Safar - Rabi-ul-Awwal 1446",
            dueDate: "2026-10-10",
            tuitionFee: 0,
            hostelMessFee: 0,
            examFee: 1500,
            scholarshipWaiver: 0,
            netPayable: 1500,
            feeType: "MONTHLY",
            status: "PENDING",
            paidAt: null,
            bankRef: null
        }
    ],

    donations: [
        {
            id: "don_1",
            receiptNo: "REC-ZKT-1446-041",
            donorName: "Sheikh Abdul Aziz Al-Ghamdi",
            email: "alghamdi@invest.sa",
            phone: "+966 50 1234567",
            amount: 500000,
            currency: "PKR",
            donationType: "ZAKAT",
            purpose: "Kafalat-e-Talib-e-Ilm (Full Boarding & Tuition for 10 Students)",
            branchId: "b1",
            paymentChannel: "Meezan Bank Online Transfer",
            receivedAt: "2026-09-22",
            isAnonymous: false
        },
        {
            id: "don_2",
            receiptNo: "REC-SDQ-1446-098",
            donorName: "Ansar of Jamia Ashrafia (Overseas UK)",
            email: "info@ashrafia-uk.org",
            phone: "+44 7911 123456",
            amount: 250000,
            currency: "PKR",
            donationType: "SADAQAH",
            purpose: "Ashrafia Free Charitable Hospital Medicine Fund",
            branchId: "b1",
            paymentChannel: "Wire Swift Transfer",
            receivedAt: "2026-09-25",
            isAnonymous: false
        },
        {
            id: "don_3",
            receiptNo: "REC-GEN-1446-112",
            donorName: "Muhsin Anonymous",
            email: null,
            phone: null,
            amount: 100000,
            currency: "PKR",
            donationType: "GENERAL_FUND",
            purpose: "Maktaba Ashrafia Manuscript Digital Preservation",
            branchId: "b1",
            paymentChannel: "Cash Office Ferozepur Road",
            receivedAt: "2026-09-27",
            isAnonymous: true
        }
    ],

    libraryBooks: [
        {
            id: "bk_1",
            accessionNo: "MAK-ASH-0142",
            isbn: "978-969-583-012-4",
            title: "Fath al-Bari Sharh Sahih al-Bukhari (15 Volumes)",
            arabicTitle: "فتح الباري شرح صحيح البخاري",
            author: "Al-Hafiz Ibn Hajar al-Asqalani (رحمه الله)",
            category: "Hadith & Commentaries",
            publisher: "Maktaba Ashrafia Lahore",
            publicationYear: 2018,
            rackLocation: "Rack H-04, Shelf B",
            totalCopies: 8,
            availableCopies: 6,
            isDigital: true
        },
        {
            id: "bk_2",
            accessionNo: "MAK-ASH-0289",
            isbn: "978-969-583-055-1",
            title: "Bada'i' as-Sana'i' fi Tartib ash-Shara'i' (10 Volumes)",
            arabicTitle: "بدائع الصنائع في ترتيب الشرائع",
            author: "Ala al-Din Abu Bakr al-Kasani (رحمه الله)",
            category: "Fiqh Hanafi Compendiums",
            publisher: "Dar al-Kutub al-Ilmiyyah",
            publicationYear: 2020,
            rackLocation: "Rack F-02, Shelf C",
            totalCopies: 6,
            availableCopies: 4,
            isDigital: true
        },
        {
            id: "bk_3",
            accessionNo: "MAK-ASH-0512",
            isbn: "978-969-583-098-8",
            title: "Ma'ariful Quran (8 Volumes Complete Tafsir)",
            arabicTitle: "معارف القرآن",
            author: "Mufti Muhammad Shafi Usmani (رحمه الله)",
            category: "Tafsir & Quranic Sciences",
            publisher: "Idaratul Ma'arif",
            publicationYear: 2022,
            rackLocation: "Rack T-01, Shelf A",
            totalCopies: 12,
            availableCopies: 9,
            isDigital: true
        },
        {
            id: "bk_4",
            accessionNo: "MAK-ASH-0891",
            isbn: "978-969-583-110-7",
            title: "Imdad-ul-Fatawa (Compilation of Rulings)",
            arabicTitle: "امداد الفتاویٰ",
            author: "Hazrat Maulana Ashraf Ali Thanwi (رحمه الله)",
            category: "Darul Ifta Collections",
            publisher: "Maktaba Ashrafia Lahore",
            publicationYear: 2019,
            rackLocation: "Rack I-03, Shelf D",
            totalCopies: 5,
            availableCopies: 3,
            isDigital: true
        }
    ],

    libraryLoans: [
        { id: "loan_1", bookId: "bk_1", userId: "u_student_1", userName: "Muhammad Talha Usmani", status: "ISSUED", requestedAt: "2026-09-20", issuedAt: "2026-09-20", dueDate: "2026-10-04", returnedAt: null, issuedBy: "u_admin" },
        { id: "loan_2", bookId: "bk_2", userId: "u_teacher_2", userName: "Mufti Ahmadur Rahman", status: "ISSUED", requestedAt: "2026-09-15", issuedAt: "2026-09-15", dueDate: "2026-10-15", returnedAt: null, issuedBy: "u_admin" }
    ],

    timetables: [
        { id: "tt_sat_1", day: "Saturday", startTime: "06:30", endTime: "08:00", periodName: "Fajr Dars", courseId: "c_bukhari_1", teacherId: "u_teacher_1", room: "Hall Imam Bukhari", classId: "cls_dawra_a" },
        { id: "tt_sat_2", day: "Saturday", startTime: "08:15", endTime: "09:45", periodName: "Sabq 2", courseId: "c_tirmidhi", teacherId: "u_teacher_1", room: "Hall Imam Bukhari", classId: "cls_dawra_a" },
        { id: "tt_sat_3", day: "Saturday", startTime: "10:15", endTime: "11:45", periodName: "Sabq 3", courseId: "c_hidayah", teacherId: "u_teacher_2", room: "Room 201", classId: "cls_aaliyah" },
        { id: "tt_sat_4", day: "Saturday", startTime: "12:15", endTime: "14:00", periodName: "Namaz-e-Zuhr, Khana & Qailulah", courseId: null, teacherId: null, room: "Grand Jamia Mosque", classId: "all" },
        { id: "tt_sat_5", day: "Saturday", startTime: "14:15", endTime: "15:45", periodName: "Asr Dars", courseId: "c_banking", teacherId: "u_teacher_2", room: "Darul Ifta Conference Room", classId: "cls_ifta" },
        { id: "tt_sun_1", day: "Sunday", startTime: "06:30", endTime: "08:00", periodName: "Fajr Dars", courseId: "c_bukhari_1", teacherId: "u_teacher_1", room: "Hall Imam Bukhari", classId: "cls_dawra_a" },
        { id: "tt_sun_2", day: "Sunday", startTime: "08:15", endTime: "09:45", periodName: "Sabq 2", courseId: "c_tirmidhi", teacherId: "u_teacher_1", room: "Hall Imam Bukhari", classId: "cls_dawra_a" },
        { id: "tt_sun_3", day: "Sunday", startTime: "10:15", endTime: "11:45", periodName: "Sabq 3", courseId: "c_hidayah", teacherId: "u_teacher_2", room: "Room 201", classId: "cls_aaliyah" },
        { id: "tt_sun_4", day: "Sunday", startTime: "12:15", endTime: "14:00", periodName: "Namaz-e-Zuhr, Khana & Qailulah", courseId: null, teacherId: null, room: "Grand Jamia Mosque", classId: "all" },
        { id: "tt_sun_5", day: "Sunday", startTime: "14:15", endTime: "15:45", periodName: "Asr Dars", courseId: "c_banking", teacherId: "u_teacher_2", room: "Darul Ifta Conference Room", classId: "cls_ifta" },
        { id: "tt_mon_1", day: "Monday", startTime: "06:30", endTime: "08:00", periodName: "Fajr Dars", courseId: "c_bukhari_1", teacherId: "u_teacher_1", room: "Hall Imam Bukhari", classId: "cls_dawra_a" },
        { id: "tt_mon_2", day: "Monday", startTime: "08:15", endTime: "09:45", periodName: "Sabq 2", courseId: "c_tirmidhi", teacherId: "u_teacher_1", room: "Hall Imam Bukhari", classId: "cls_dawra_a" },
        { id: "tt_mon_3", day: "Monday", startTime: "10:15", endTime: "11:45", periodName: "Sabq 3", courseId: "c_hidayah", teacherId: "u_teacher_2", room: "Room 201", classId: "cls_aaliyah" },
        { id: "tt_mon_4", day: "Monday", startTime: "12:15", endTime: "14:00", periodName: "Namaz-e-Zuhr, Khana & Qailulah", courseId: null, teacherId: null, room: "Grand Jamia Mosque", classId: "all" },
        { id: "tt_mon_5", day: "Monday", startTime: "14:15", endTime: "15:45", periodName: "Asr Dars", courseId: "c_banking", teacherId: "u_teacher_2", room: "Darul Ifta Conference Room", classId: "cls_ifta" },
        { id: "tt_tue_1", day: "Tuesday", startTime: "06:30", endTime: "08:00", periodName: "Fajr Dars", courseId: "c_bukhari_1", teacherId: "u_teacher_1", room: "Hall Imam Bukhari", classId: "cls_dawra_a" },
        { id: "tt_tue_2", day: "Tuesday", startTime: "08:15", endTime: "09:45", periodName: "Sabq 2", courseId: "c_tirmidhi", teacherId: "u_teacher_1", room: "Hall Imam Bukhari", classId: "cls_dawra_a" },
        { id: "tt_tue_3", day: "Tuesday", startTime: "10:15", endTime: "11:45", periodName: "Sabq 3", courseId: "c_hidayah", teacherId: "u_teacher_2", room: "Room 201", classId: "cls_aaliyah" },
        { id: "tt_tue_4", day: "Tuesday", startTime: "12:15", endTime: "14:00", periodName: "Namaz-e-Zuhr, Khana & Qailulah", courseId: null, teacherId: null, room: "Grand Jamia Mosque", classId: "all" },
        { id: "tt_tue_5", day: "Tuesday", startTime: "14:15", endTime: "15:45", periodName: "Asr Dars", courseId: "c_banking", teacherId: "u_teacher_2", room: "Darul Ifta Conference Room", classId: "cls_ifta" },
        { id: "tt_wed_1", day: "Wednesday", startTime: "06:30", endTime: "08:00", periodName: "Fajr Dars", courseId: "c_bukhari_1", teacherId: "u_teacher_1", room: "Hall Imam Bukhari", classId: "cls_dawra_a" },
        { id: "tt_wed_2", day: "Wednesday", startTime: "08:15", endTime: "09:45", periodName: "Sabq 2", courseId: "c_tirmidhi", teacherId: "u_teacher_1", room: "Hall Imam Bukhari", classId: "cls_dawra_a" },
        { id: "tt_wed_3", day: "Wednesday", startTime: "10:15", endTime: "11:45", periodName: "Sabq 3", courseId: "c_hidayah", teacherId: "u_teacher_2", room: "Room 201", classId: "cls_aaliyah" },
        { id: "tt_wed_4", day: "Wednesday", startTime: "12:15", endTime: "14:00", periodName: "Namaz-e-Zuhr, Khana & Qailulah", courseId: null, teacherId: null, room: "Grand Jamia Mosque", classId: "all" },
        { id: "tt_wed_5", day: "Wednesday", startTime: "14:15", endTime: "15:45", periodName: "Asr Dars", courseId: "c_banking", teacherId: "u_teacher_2", room: "Darul Ifta Conference Room", classId: "cls_ifta" },
        { id: "tt_thu_1", day: "Thursday", startTime: "06:30", endTime: "08:00", periodName: "Fajr Dars", courseId: "c_bukhari_1", teacherId: "u_teacher_1", room: "Hall Imam Bukhari", classId: "cls_dawra_a" },
        { id: "tt_thu_2", day: "Thursday", startTime: "08:15", endTime: "09:45", periodName: "Sabq 2", courseId: "c_tirmidhi", teacherId: "u_teacher_1", room: "Hall Imam Bukhari", classId: "cls_dawra_a" },
        { id: "tt_thu_3", day: "Thursday", startTime: "10:15", endTime: "11:45", periodName: "Sabq 3", courseId: "c_hidayah", teacherId: "u_teacher_2", room: "Room 201", classId: "cls_aaliyah" },
        { id: "tt_thu_4", day: "Thursday", startTime: "12:15", endTime: "14:00", periodName: "Namaz-e-Zuhr, Khana & Qailulah", courseId: null, teacherId: null, room: "Grand Jamia Mosque", classId: "all" },
        { id: "tt_thu_5", day: "Thursday", startTime: "14:15", endTime: "15:45", periodName: "Asr Dars", courseId: "c_banking", teacherId: "u_teacher_2", room: "Darul Ifta Conference Room", classId: "cls_ifta" }
    ],

    virtualClasses: [
        {
            id: "vc_101",
            meetingUuid: "ASH-ZOOM-982-114-889",
            title: "Live Dars: Sahih al-Bukhari - Kitab al-Iman & Bab Halat al-Qalb",
            urduTitle: "درسِ براہ راست: صحیح البخاری شریف - کتاب الایمان",
            hostTeacher: "Qari Arshad Ubaid (Sheikh-ul-Hadith)",
            hostId: "u_teacher_1",
            classId: "cls_dawra_a",
            className: "Dawra-e-Hadith (Alimiyyah Final) - Section A",
            courseId: "c_bukhari_1",
            courseName: "Sahih al-Bukhari (Jild 1)",
            roomName: "Hall Imam Bukhari (Virtual Studio 1)",
            scheduledStart: "2026-09-28 11:00 AM",
            durationMinutes: 75,
            passcode: "ASHRAFIA1947",
            status: "LIVE",
            isLive: true,
            activeParticipants: 42,
            recordingStatus: "RECORDING_ACTIVE",
            attendanceCount: 42,
            maxCapacity: 100,
            allowScreenShare: true,
            allowWhiteboard: true,
            muteOnEntry: true
        },
        {
            id: "vc_102",
            meetingUuid: "ASH-ZOOM-451-870-221",
            title: "Takhassus Fiqh: Contemporary Islamic Contracts & Crypto Rulings",
            urduTitle: "فقہی سیمینار: جدید مالیاتی معاملات اور ڈیجیٹل کرنسی کا شرعی حکم",
            hostTeacher: "Mufti Ahmadur Rahman (Darul Ifta)",
            hostId: "u_teacher_2",
            classId: "cls_ifta",
            className: "Takhassus fil-Ifta (1st Year)",
            courseId: "c_banking",
            courseName: "Islamic Banking & Modern Jurisprudence",
            roomName: "Darul Ifta Conference Studio",
            scheduledStart: "2026-09-28 11:15 AM",
            durationMinutes: 90,
            passcode: "IFTA2026",
            status: "LIVE",
            isLive: true,
            activeParticipants: 19,
            recordingStatus: "RECORDING_ACTIVE",
            attendanceCount: 19,
            maxCapacity: 35,
            allowScreenShare: true,
            allowWhiteboard: true,
            muteOnEntry: false
        },
        {
            id: "vc_103",
            meetingUuid: "ASH-ZOOM-773-902-114",
            title: "Al-Hidayah fi al-Fiqh: Kitab al-Buyu & Shuf'ah Discourse",
            urduTitle: "ہدایہ فقہ حنفی: کتاب البیوع و شفعہ کی تشریح",
            hostTeacher: "Mufti Ahmadur Rahman",
            hostId: "u_teacher_2",
            classId: "cls_aaliyah",
            className: "Aaliyah (7th Year)",
            courseId: "c_hidayah",
            courseName: "Al-Hidayah fi al-Fiqh",
            roomName: "Room 201 (Virtual Hall B)",
            scheduledStart: "2026-09-28 10:30 AM",
            durationMinutes: 60,
            passcode: "HIDAYAH7",
            status: "LIVE",
            isLive: true,
            activeParticipants: 35,
            recordingStatus: "RECORDING_PAUSED",
            attendanceCount: 35,
            maxCapacity: 80,
            allowScreenShare: true,
            allowWhiteboard: true,
            muteOnEntry: true
        },
        {
            id: "vc_104",
            meetingUuid: "ASH-ZOOM-612-884-390",
            title: "Jami' at-Tirmidhi: Abwab al-Buyu & Fiqh al-Hadith",
            urduTitle: "جامع الترمذی: ابواب البیوع وفقہ الحدیث",
            hostTeacher: "Qari Arshad Ubaid (Sheikh-ul-Hadith)",
            hostId: "u_teacher_1",
            classId: "cls_dawra_a",
            className: "Dawra-e-Hadith (Alimiyyah Final) - Section A",
            courseId: "c_tirmidhi",
            courseName: "Jami' at-Tirmidhi",
            roomName: "Hall Imam Bukhari",
            scheduledStart: "2026-09-28 04:30 PM",
            durationMinutes: 60,
            passcode: "TIRMIDHI26",
            status: "UPCOMING",
            isLive: false,
            activeParticipants: 0,
            recordingStatus: "SCHEDULED",
            attendanceCount: 0,
            maxCapacity: 100,
            allowScreenShare: true,
            allowWhiteboard: true,
            muteOnEntry: true
        },
        {
            id: "vc_105",
            meetingUuid: "ASH-ZOOM-230-551-789",
            title: "Tajweed & Sifat al-Huroof: Al-Muqaddimah al-Jazariyyah",
            urduTitle: "تجوید و صفات الحروف: شرح المقدمة الجزریة",
            hostTeacher: "Qari Arshad Ubaid",
            hostId: "u_teacher_1",
            classId: "cls_hifz_3",
            className: "Hifz-ul-Quran (Daur-e-Kamil)",
            courseId: "c_tajweed",
            courseName: "Al-Muqaddimah al-Jazariyyah",
            roomName: "Maktaba Tajweed Studio",
            scheduledStart: "2026-09-29 07:00 AM",
            durationMinutes: 45,
            passcode: "JAZARIYYAH",
            status: "UPCOMING",
            isLive: false,
            activeParticipants: 0,
            recordingStatus: "SCHEDULED",
            attendanceCount: 0,
            maxCapacity: 40,
            allowScreenShare: true,
            allowWhiteboard: true,
            muteOnEntry: false
        },
        {
            id: "vc_106",
            meetingUuid: "ASH-ZOOM-119-332-901",
            title: "Dawra-e-Hadith Section B: Sunan Abi Dawud Session 12",
            urduTitle: "سنن ابی داؤد شریف - باب الصلاة",
            hostTeacher: "Qari Arshad Ubaid",
            hostId: "u_teacher_1",
            classId: "cls_dawra_b",
            className: "Dawra-e-Hadith (Alimiyyah Final) - Section B",
            courseId: "c_bukhari_1",
            courseName: "Sunan Abi Dawud",
            roomName: "Hall Imam Muslim",
            scheduledStart: "2026-09-27 08:30 AM",
            durationMinutes: 70,
            passcode: "ABUDAWUD",
            status: "COMPLETED",
            isLive: false,
            activeParticipants: 62,
            recordingStatus: "RECORDING_ARCHIVED",
            attendanceCount: 62,
            maxCapacity: 90,
            allowScreenShare: true,
            allowWhiteboard: true,
            muteOnEntry: true
        }
    ],

    virtualClassRecordings: [
        {
            id: "rec_201",
            sessionId: "vc_101",
            title: "Sahih al-Bukhari - Kitab al-Iman & Bab Halat al-Qalb (Lecture 14)",
            urduTitle: "صحیح البخاری شریف - کتاب الایمان (لیکچر ۱۴)",
            classId: "cls_dawra_a",
            className: "Dawra-e-Hadith (Section A)",
            courseName: "Sahih al-Bukhari",
            teacherName: "Qari Arshad Ubaid",
            teacherId: "u_teacher_1",
            recordedDate: "2026-09-27",
            recordedTime: "11:00 AM",
            durationMinutes: 72,
            durationFormatted: "1h 12m",
            fileSizeBytes: 713031680,
            fileSizeFormatted: "680 MB",
            format: "MP4 (1080p H.264)",
            resolution: "1920x1080 @ 30fps",
            storageKey: "s3://ashrafia-lms-vault/recordings/2026/09/bukhari_lec14.mp4",
            downloadUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
            videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
            retentionExpiryDate: "2026-12-26",
            daysRemaining: 89,
            viewsCount: 54,
            downloadsCount: 18,
            autoDeleteProtected: false,
            status: "ACTIVE"
        },
        {
            id: "rec_202",
            sessionId: "vc_102",
            title: "Contemporary Islamic Banking: Murabaha & Diminishing Musharakah Structuring",
            urduTitle: "اسلامی بینکاری: مرابحہ اور مشارکہ متناقصہ کی فقہی شرائط",
            classId: "cls_ifta",
            className: "Takhassus fil-Ifta (1st Year)",
            courseName: "Islamic Banking & Modern Jurisprudence",
            teacherName: "Mufti Ahmadur Rahman",
            teacherId: "u_teacher_2",
            recordedDate: "2026-09-25",
            recordedTime: "03:15 PM",
            durationMinutes: 85,
            durationFormatted: "1h 25m",
            fileSizeBytes: 849346560,
            fileSizeFormatted: "810 MB",
            format: "MP4 (1080p H.264)",
            resolution: "1920x1080 @ 30fps",
            storageKey: "s3://ashrafia-lms-vault/recordings/2026/09/banking_murabaha.mp4",
            downloadUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
            videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
            retentionExpiryDate: "2026-12-24",
            daysRemaining: 87,
            viewsCount: 29,
            downloadsCount: 12,
            autoDeleteProtected: true,
            status: "ACTIVE"
        },
        {
            id: "rec_203",
            sessionId: "vc_103",
            title: "Al-Hidayah fi al-Fiqh: Kitab al-Buyu & Shuf'ah (Lec 28)",
            urduTitle: "ہدایہ فقہ حنفی: کتاب البیوع و شفعہ کی تشریح",
            classId: "cls_aaliyah",
            className: "Aaliyah (7th Year)",
            courseName: "Al-Hidayah fi al-Fiqh",
            teacherName: "Mufti Ahmadur Rahman",
            teacherId: "u_teacher_2",
            recordedDate: "2026-09-24",
            recordedTime: "10:30 AM",
            durationMinutes: 58,
            durationFormatted: "58m",
            fileSizeBytes: 566231040,
            fileSizeFormatted: "540 MB",
            format: "MP4 (1080p H.264)",
            resolution: "1920x1080 @ 30fps",
            storageKey: "s3://ashrafia-lms-vault/recordings/2026/09/hidayah_buyu.mp4",
            downloadUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
            videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
            retentionExpiryDate: "2026-12-23",
            daysRemaining: 86,
            viewsCount: 46,
            downloadsCount: 14,
            autoDeleteProtected: false,
            status: "ACTIVE"
        },
        {
            id: "rec_204",
            sessionId: "vc_105",
            title: "Tajweed & Sifat al-Huroof: Al-Muqaddimah al-Jazariyyah (Session 09)",
            urduTitle: "تجوید و صفات الحروف: شرح المقدمة الجزریة",
            classId: "cls_hifz_3",
            className: "Hifz-ul-Quran (Daur-e-Kamil)",
            courseName: "Al-Muqaddimah al-Jazariyyah",
            teacherName: "Qari Arshad Ubaid",
            teacherId: "u_teacher_1",
            recordedDate: "2026-09-22",
            recordedTime: "07:00 AM",
            durationMinutes: 45,
            durationFormatted: "45m",
            fileSizeBytes: 450887680,
            fileSizeFormatted: "430 MB",
            format: "MP4 (1080p H.264)",
            resolution: "1920x1080 @ 30fps",
            storageKey: "s3://ashrafia-lms-vault/recordings/2026/09/tajweed_makharij.mp4",
            downloadUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
            videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
            retentionExpiryDate: "2026-12-21",
            daysRemaining: 84,
            viewsCount: 38,
            downloadsCount: 9,
            autoDeleteProtected: false,
            status: "ACTIVE"
        }
    ],

    virtualClassSettings: {
        retentionDays: 90,
        autoRecord: true,
        allowStudentDownload: false,
        storageQuotaGB: 50,
        usedStorageGB: 2.46,
        cloudProvider: "Jamia Ashrafia High-Performance Cloud Vault (AWS S3 AES-256)",
        autoCleanupEnabled: true,
        lastCleanupDate: "2026-09-28",
        recordingQuality: "1080p HD",
        maxMeetingDurationMinutes: 180,
        simultaneousRoomsLimit: 12
    },

    notifications: [
        {
            id: "notif_1",
            sender: "Mohtamim Jamia Ashrafia",
            title: "Welcome to Academic Session 1446-1447 AH",
            message: "Welcome to all new and continuing scholars. Remember the golden advice of Hazrat Mufti Muhammad Hassan (RA): Knowledge is a sacred trust coupled with fear of Allah (علم اور تقویٰ).",
            time: "1 hour ago",
            isRead: false,
            category: "ACADEMIC",
            badge: "Institutional"
        },
        {
            id: "notif_2",
            sender: "Nazim-e-Taleemat",
            title: "Shashmahi Midterm Exam Date Sheet Published",
            message: "The Wifaq-pattern examination for all Dars-e-Nizami years will commence from 15 October 2026. Hall allocations have been finalized.",
            time: "3 hours ago",
            isRead: false,
            category: "EXAM",
            badge: "Exams"
        },
        {
            id: "notif_3",
            sender: "Darul Ifta Wing",
            title: "Live Virtual Classroom Started",
            message: "Sheikh-ul-Hadith Qari Arshad Ubaid has initiated the live Bukhari lecture in Hall Imam Bukhari. Click to join the Zoom room.",
            time: "10 minutes ago",
            isRead: false,
            category: "LIVE_CLASS",
            badge: "Live Room"
        },
        {
            id: "notif_4",
            sender: "Nazim-e-Maliyat",
            title: "Fee Challan Safar 1446 Issued",
            message: "Challans have been generated. Deserving students may submit Kafalat/Zakat scholarship waiver applications before 10th October.",
            time: "1 day ago",
            isRead: true,
            category: "FEE",
            badge: "Accounts"
        }
    ],

    // Comprehensive Attendance Records (Students and Teachers)
    attendance: [
        // Today's Initial Attendance (2026-09-28)
        {
            id: "att_today_1",
            userId: "u_student_2",
            userName: "Hafiz Usman Tariq",
            role: "STUDENT",
            identifier: "ASH-2024-042",
            classId: "cls_aaliyah",
            className: "Aaliyah (1st Year)",
            date: "2026-09-28",
            checkInTime: "07:45 AM",
            checkOutTime: null,
            status: "PRESENT",
            session: "DAILY_ACADEMIC",
            notes: "On-time arrival at Main Campus gate."
        },
        {
            id: "att_today_2",
            userId: "u_student_3",
            userName: "Abdul Rehman Farooqi",
            role: "STUDENT",
            identifier: "ASH-2024-008",
            classId: "cls_ifta",
            className: "Takhassus fil-Ifta",
            date: "2026-09-28",
            checkInTime: "08:05 AM",
            checkOutTime: null,
            status: "PRESENT",
            session: "DAILY_ACADEMIC",
            notes: "Darul Ifta research desk check-in."
        },
        {
            id: "att_today_3",
            userId: "u_student_4",
            userName: "Zaid bin Harith",
            role: "STUDENT",
            identifier: "ASH-2024-115",
            classId: "cls_hifz",
            className: "Hifz-ul-Quran",
            date: "2026-09-28",
            checkInTime: "08:35 AM",
            checkOutTime: null,
            status: "LATE",
            session: "DAILY_ACADEMIC",
            notes: "Late arrival due to Metro bus delay."
        },
        {
            id: "att_today_4",
            userId: "u_student_5",
            userName: "Bilal Ahmed Qureshi",
            role: "STUDENT",
            identifier: "ASH-2024-073",
            classId: "cls_qiraat",
            className: "Qira'at Sab'ah",
            date: "2026-09-28",
            checkInTime: "07:50 AM",
            checkOutTime: null,
            status: "PRESENT",
            session: "DAILY_ACADEMIC",
            notes: "Tajweed hall morning session."
        },
        {
            id: "att_today_5",
            userId: "u_teacher_2",
            userName: "Mufti Ahmadur Rahman",
            role: "TEACHER",
            identifier: "darulifta@jamiaashrafia.org",
            classId: "cls_ifta",
            className: "Fiqh & Fatawa Dept",
            date: "2026-09-28",
            checkInTime: "07:30 AM",
            checkOutTime: null,
            status: "PRESENT",
            session: "DAILY_ACADEMIC",
            notes: "Morning fatwa research and lectures."
        },

        // Yesterday's Attendance Records (2026-09-27)
        {
            id: "att_yest_1",
            userId: "u_student_1",
            userName: "Muhammad Talha Usmani",
            role: "STUDENT",
            identifier: "ASH-2024-001",
            classId: "cls_dawra_a",
            className: "Dawra-e-Hadith (Section A)",
            date: "2026-09-27",
            checkInTime: "06:20 AM",
            checkOutTime: "01:30 PM",
            status: "PRESENT",
            session: "FAJR_DARS",
            notes: "Bukhari Sharif Hall Imam Bukhari."
        },
        {
            id: "att_yest_2",
            userId: "u_student_2",
            userName: "Hafiz Usman Tariq",
            role: "STUDENT",
            identifier: "ASH-2024-042",
            classId: "cls_aaliyah",
            className: "Aaliyah (1st Year)",
            date: "2026-09-27",
            checkInTime: "07:40 AM",
            checkOutTime: "01:30 PM",
            status: "PRESENT",
            session: "DAILY_ACADEMIC",
            notes: "Completed all 4 periods."
        },
        {
            id: "att_yest_3",
            userId: "u_teacher_1",
            userName: "Qari Arshad Ubaid",
            role: "TEACHER",
            identifier: "arshad.ubaid@jamiaashrafia.org",
            classId: "cls_dawra_a",
            className: "Dawra-e-Hadith (Hadith Studies)",
            date: "2026-09-27",
            checkInTime: "06:15 AM",
            checkOutTime: "02:00 PM",
            status: "PRESENT",
            session: "FAJR_DARS",
            notes: "Delivered morning Bukhari dars."
        },
        {
            id: "att_yest_4",
            userId: "u_teacher_2",
            userName: "Mufti Ahmadur Rahman",
            role: "TEACHER",
            identifier: "darulifta@jamiaashrafia.org",
            classId: "cls_ifta",
            className: "Darul Ifta",
            date: "2026-09-27",
            checkInTime: "07:45 AM",
            checkOutTime: "03:30 PM",
            status: "PRESENT",
            session: "DAILY_ACADEMIC",
            notes: "Fatwa consultation hours."
        },
        {
            id: "att_yest_5",
            userId: "u_student_6",
            userName: "Zubair Masood",
            role: "STUDENT",
            identifier: "ASH-2024-019",
            classId: "cls_dawra_a",
            className: "Dawra-e-Hadith (Section A)",
            date: "2026-09-27",
            checkInTime: "08:45 AM",
            checkOutTime: "01:15 PM",
            status: "LATE",
            session: "DAILY_ACADEMIC",
            notes: "Permitted by Hostel Warden."
        },
        {
            id: "att_yest_6",
            userId: "u_student_8",
            userName: "Hamza Noor",
            role: "STUDENT",
            identifier: "ASH-2024-094",
            classId: "cls_dawra_b",
            className: "Dawra-e-Hadith (Section B)",
            date: "2026-09-27",
            checkInTime: "06:25 AM",
            checkOutTime: "01:30 PM",
            status: "PRESENT",
            session: "FAJR_DARS",
            notes: "Hostel B resident."
        },

        // Earlier Attendance Records (2026-09-26)
        {
            id: "att_prev_1",
            userId: "u_student_1",
            userName: "Muhammad Talha Usmani",
            role: "STUDENT",
            identifier: "ASH-2024-001",
            classId: "cls_dawra_a",
            className: "Dawra-e-Hadith (Section A)",
            date: "2026-09-26",
            checkInTime: "06:25 AM",
            checkOutTime: "01:45 PM",
            status: "PRESENT",
            session: "FAJR_DARS",
            notes: "Submitted weekly Tirmidhi notes."
        },
        {
            id: "att_prev_2",
            userId: "u_teacher_1",
            userName: "Qari Arshad Ubaid",
            role: "TEACHER",
            identifier: "arshad.ubaid@jamiaashrafia.org",
            classId: "cls_dawra_a",
            className: "Dawra-e-Hadith",
            date: "2026-09-26",
            checkInTime: "06:10 AM",
            checkOutTime: "01:45 PM",
            status: "PRESENT",
            session: "FAJR_DARS",
            notes: "Conducted live Zoom stream."
        },
        {
            id: "att_prev_3",
            userId: "u_student_4",
            userName: "Zaid bin Harith",
            role: "STUDENT",
            identifier: "ASH-2024-115",
            classId: "cls_hifz",
            className: "Hifz-ul-Quran",
            date: "2026-09-26",
            checkInTime: null,
            checkOutTime: null,
            status: "ABSENT",
            session: "DAILY_ACADEMIC",
            notes: "Sick leave application submitted."
        }
    ],

};

// DATA STORE CONTROLLER
const DATA_SCHEMA_VERSION = 3;
const clone = (v) => JSON.parse(JSON.stringify(v));

// Collections shared with every other user through the server record store (see server/lms-api.js)
const SYNC_COLLECTIONS = [
    'users', 'classes', 'courses', 'courseMaterials', 'assignments', 'assignmentSubmissions',
    'exams', 'examSubmissions', 'examResults', 'timetables', 'libraryBooks', 'libraryLoans',
    'feeStructures', 'feeChallans', 'donations', 'virtualClasses', 'virtualClassRecordings', 'attendance'
];

// "06:30 AM" -> "06:30", "02:15 PM" -> "14:15"
function to24h(t) {
    const m = String(t || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!m) return '';
    let h = parseInt(m[1], 10);
    const ap = (m[3] || '').toUpperCase();
    if (ap === 'PM' && h < 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m[2]}`;
}

// One-time upgrades for data saved by older versions of the portal
function migrateData(parsed) {
    const from = parsed.schemaVersion || 1;
    if (from >= DATA_SCHEMA_VERSION) return false;
    if (from < 2) migrateToV2(parsed);
    if (from < 3) migrateToV3(parsed);
    parsed.schemaVersion = DATA_SCHEMA_VERSION;
    return true;
}

// Roles: Super Admin's access is no longer stored, the separate Permissions page is gone,
// "Academic Nazim" is now the default Admin role (which manages roles) and Accountant is a custom role
function migrateToV3(parsed) {
    const roles = parsed.roles || [];
    const admin = roles.find(r => r.id === 'ACADEMIC_ADMIN');
    if (admin && (!admin.name || admin.name === 'Academic Nazim')) admin.name = 'Admin';
    const accountant = roles.find(r => r.id === 'ACCOUNTANT');
    if (accountant) accountant.isSystem = false;

    const perms = parsed.roleModulePermissions;
    if (perms) {
        delete perms.SUPER_ADMIN;
        Object.values(perms).forEach(p => { if (p) delete p.permissions; });
        if (perms.ACADEMIC_ADMIN) perms.ACADEMIC_ADMIN.roles = true;
    }
}

function migrateToV2(parsed) {
    ['courseMaterials', 'examSubmissions', 'libraryLoans', 'feeStructures'].forEach(key => {
        if (!Array.isArray(parsed[key])) parsed[key] = clone(INITIAL_DATA[key] || []);
    });
    ['classes', 'courses', 'assignments', 'assignmentSubmissions', 'exams', 'examResults', 'feeChallans',
        'donations', 'libraryBooks', 'timetables'].forEach(key => {
        if (!Array.isArray(parsed[key])) parsed[key] = clone(INITIAL_DATA[key] || []);
    });

    // Classes referenced by students but missing, and per-kitab teacher allocation
    INITIAL_DATA.classes.forEach(seed => {
        const existing = parsed.classes.find(c => c.id === seed.id);
        if (!existing) {
            parsed.classes.push(clone(seed));
        } else {
            if (!Array.isArray(existing.courseTeachers)) existing.courseTeachers = clone(seed.courseTeachers);
            if (!existing.room) existing.room = seed.room;
            if (!existing.capacity) existing.capacity = seed.capacity || existing.enrolledCount || 50;
        }
    });
    parsed.classes.forEach(c => {
        if (!Array.isArray(c.courseTeachers)) c.courseTeachers = [];
        delete c.enrolledCount;
    });

    // Exams: real question papers & publish flags
    parsed.exams.forEach(ex => {
        const seed = INITIAL_DATA.exams.find(s => s.id === ex.id);
        if (!Array.isArray(ex.questions)) ex.questions = seed ? clone(seed.questions) : [];
        if (!ex.mode) ex.mode = ex.questions.length ? 'ONLINE' : 'OFFLINE';
        if (!ex.status) ex.status = 'SCHEDULED';
        if (ex.resultsPublished === undefined) ex.resultsPublished = seed ? seed.resultsPublished : false;
        if (/AM|PM/i.test(ex.startTime || '')) ex.startTime = to24h(ex.startTime);
        if (seed && seed.totalMarks !== ex.totalMarks && ex.questions.length) ex.totalMarks = seed.totalMarks;
    });
    INITIAL_DATA.exams.forEach(seed => {
        if (!parsed.exams.some(e => e.id === seed.id)) parsed.exams.push(clone(seed));
    });
    parsed.examResults.forEach(r => {
        const ex = parsed.exams.find(e => e.id === r.examId);
        if (!r.totalMarks) r.totalMarks = ex ? ex.totalMarks : 100;
        if (r.published === undefined) r.published = ex ? !!ex.resultsPublished : true;
    });

    // Timetable: day-specific slots with teacher ids and 24h start/end times
    const oldSeedOnly = parsed.timetables.every(t => /^tt_\d$/.test(t.id));
    if (oldSeedOnly) {
        parsed.timetables = clone(INITIAL_DATA.timetables);
    } else {
        parsed.timetables.forEach(t => {
            if (!t.startTime && t.time) {
                const [a, b] = String(t.time).split('-').map(x => x.trim());
                t.startTime = to24h(a);
                t.endTime = to24h(b);
            }
            if (!t.teacherId && t.teacher) {
                const tu = (parsed.users || []).find(u => u.name === t.teacher);
                t.teacherId = tu ? tu.id : null;
            }
        });
    }

    // Fee challans: type + verification flow
    parsed.feeChallans.forEach(ch => {
        if (!ch.feeType) ch.feeType = 'MONTHLY';
    });

    // Library: e-book availability depends on an uploaded file
    parsed.libraryBooks.forEach(b => {
        if (b.isDigital && !b.digitalUrl) b.isDigital = false;
    });

    // Assignment submission attachments
    parsed.assignmentSubmissions.forEach(s => {
        if (!Array.isArray(s.attachments)) s.attachments = [];
        delete s.attachmentUrl;
    });
}

// ---------------------------------------------------------------------------
// Multi-user sync engine: pulls other users' changes and pushes local ones
// ---------------------------------------------------------------------------

const SYNC_STATE_KEY = 'JAMIA_ASHRAFIA_LMS_SYNC_V1';
// Set at sign-in: the next full pull replaces the local copy with what the server shares with this user
const FRESH_SESSION_KEY = 'JAMIA_ASHRAFIA_FRESH_SESSION';

function hashString(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36) + ':' + str.length;
}

function recordHash(collection, rec) {
    if (collection === 'users' && rec && 'password' in rec) {
        const copy = { ...rec };
        delete copy.password;
        return hashString(JSON.stringify(copy));
    }
    return hashString(JSON.stringify(rec));
}

const SyncEngine = {
    enabled: false,
    online: false,
    since: null,
    snap: {},       // collection -> id -> hash of the record as last agreed with the server
    pw: {},         // user id -> hash of the password last sent
    forceFull: false,
    rejected: {},   // collection -> Set of ids the server refused in the last push
    pushTimer: null,
    chain: Promise.resolve(),
    lastFullAt: 0,

    loadState() {
        try {
            const st = JSON.parse(localStorage.getItem(SYNC_STATE_KEY) || '{}');
            this.since = st.since || null;
            this.snap = st.snap || {};
            this.pw = st.pw || {};
        } catch (e) {
            this.since = null; this.snap = {}; this.pw = {};
        }
    },

    saveState() {
        try {
            localStorage.setItem(SYNC_STATE_KEY, JSON.stringify({ since: this.since, snap: this.snap, pw: this.pw }));
        } catch (e) { /* quota: state is rebuilt on next full pull */ }
    },

    // Who is calling is known to the server from the session cookie; no identity is sent from here
    headers() {
        return { 'Content-Type': 'application/json' };
    },

    // The session ended (signed out elsewhere, password reset, account deactivated) or needs a new password
    checkAuth(res) {
        if (res.status === 401) {
            this.enabled = false;
            localStorage.removeItem('JAMIA_CURRENT_USER_ID');
            if (!/login\.html$/.test(window.location.pathname)) window.location.replace('login.html?expired=1');
            throw new Error('signed out');
        }
        if (res.status === 403 && res.headers.get('content-type')?.includes('json')) {
            return res.clone().json().then(body => {
                if (body && body.mustChangePassword) {
                    this.enabled = false;
                    window.location.replace('login.html#change-password');
                    throw new Error('password change required');
                }
            }, () => {});
        }
    },

    enqueue(fn) {
        this.chain = this.chain.then(fn, fn).catch(err => console.warn('[Sync]', err));
        return this.chain;
    },

    mergeCollection(data, coll, serverRecs, opts) {
        if (!Array.isArray(data[coll])) data[coll] = [];
        const local = data[coll];
        const snap = this.snap[coll] = this.snap[coll] || {};
        const indexById = new Map();
        local.forEach((r, i) => { if (r && r.id) indexById.set(r.id, i); });
        const serverIds = new Set();
        let changed = false;

        (serverRecs || []).forEach(rec => {
            serverIds.add(rec.id);
            const sh = recordHash(coll, rec);
            const idx = indexById.get(rec.id);
            if (idx === undefined) {
                // Deleted here while offline and untouched on the server: keep it deleted (pushed next)
                if (snap[rec.id] === sh) return;
                local.push(rec);
                indexById.set(rec.id, local.length - 1);
                snap[rec.id] = sh;
                if (coll === 'users') this.pw[rec.id] = undefined;
                changed = true;
                return;
            }
            const cur = local[idx];
            const lh = recordHash(coll, cur);
            if (lh === sh) {
                snap[rec.id] = sh;
                if (coll === 'users' && cur.password) this.pw[rec.id] = this.pw[rec.id] || hashString(cur.password);
                return;
            }
            // Changed locally since last sync while the server copy is unchanged: keep ours, push later
            if (snap[rec.id] !== undefined && snap[rec.id] === sh && lh !== sh) return;
            const merged = (coll === 'users' && cur.password) ? { ...rec, password: cur.password } : rec;
            local[idx] = merged;
            snap[rec.id] = sh;
            if (coll === 'users' && cur.password) this.pw[rec.id] = hashString(cur.password);
            changed = true;
        });

        if (opts.full && opts.present) {
            for (let i = local.length - 1; i >= 0; i--) {
                const r = local[i];
                if (!r || !r.id || serverIds.has(r.id)) continue;
                // Known to the server before and unchanged here: someone else deleted it
                if (snap[r.id] !== undefined && recordHash(coll, r) === snap[r.id]) {
                    local.splice(i, 1);
                    delete snap[r.id];
                    changed = true;
                }
            }
        }

        (opts.deleted || []).forEach(id => {
            const idx = local.findIndex(r => r && r.id === id);
            if (idx >= 0 && (snap[id] === undefined || recordHash(coll, local[idx]) === snap[id])) {
                local.splice(idx, 1);
                changed = true;
            }
            delete snap[id];
        });
        return changed;
    },

    async pull(full) {
        const data = window.LmsData;
        const url = full || !this.since ? '/api/store' : `/api/store?since=${encodeURIComponent(this.since)}`;
        const res = await fetch(url, { headers: this.headers(), cache: 'no-store' });
        await this.checkAuth(res);
        if (!res.ok) throw new Error(`pull failed (${res.status})`);
        const payload = await res.json();
        const isFull = !!payload.full;
        const present = new Set(payload.presentCollections || []);
        const changedCollections = [];

        // First full pull after signing in: the server's copy (only what this user may see) replaces the local one.
        // Collections the server does not have yet keep their local seed data, so a new installation can be seeded.
        if (isFull && localStorage.getItem(FRESH_SESSION_KEY) === '1') {
            SYNC_COLLECTIONS.forEach(coll => {
                if (!present.has(coll)) return;
                const recs = (payload.collections || {})[coll] || [];
                data[coll] = recs.slice();
                const snap = this.snap[coll] = {};
                recs.forEach(r => { snap[r.id] = recordHash(coll, r); });
                changedCollections.push(coll);
            });
            this.pw = {};
            localStorage.removeItem(FRESH_SESSION_KEY);
        }

        // Private collections the server only shares with their owner: drop other people's
        // records locally (e.g. seed data) without treating that as a deletion to push
        const myId = localStorage.getItem('JAMIA_CURRENT_USER_ID');
        Object.entries(payload.scope || {}).forEach(([coll, field]) => {
            if (!Array.isArray(data[coll])) return;
            const snap = this.snap[coll] = this.snap[coll] || {};
            const before = data[coll].length;
            data[coll] = data[coll].filter(r => {
                if (!r || (r[field] === myId && (coll !== 'examResults' || r.published))) return true;
                delete snap[r.id];
                return false;
            });
            if (data[coll].length !== before) changedCollections.push(coll);
        });

        SYNC_COLLECTIONS.forEach(coll => {
            const recs = (payload.collections || {})[coll] || [];
            const deleted = (payload.deleted || {})[coll] || [];
            if (!recs.length && !deleted.length && !(isFull && present.has(coll))) return;
            if (this.mergeCollection(data, coll, recs, { full: isFull, present: present.has(coll), deleted })) {
                changedCollections.push(coll);
            }
        });

        // Local records the server refused and does not have: they were never valid, drop them
        if (isFull) {
            Object.entries(this.rejected).forEach(([coll, ids]) => {
                const onServer = new Set(((payload.collections || {})[coll] || []).map(r => r.id));
                const before = (data[coll] || []).length;
                data[coll] = (data[coll] || []).filter(r => !(ids.has(r.id) && !onServer.has(r.id)));
                if (data[coll].length !== before && !changedCollections.includes(coll)) changedCollections.push(coll);
            });
            this.rejected = {};
        }

        this.since = payload.serverTime;
        if (isFull) this.lastFullAt = Date.now();
        this.online = true;
        if (changedCollections.length) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        }
        this.saveState();
        if (changedCollections.length) {
            window.dispatchEvent(new CustomEvent('lms:data_synced', { detail: { collections: changedCollections } }));
        }
        return changedCollections;
    },

    computePush() {
        const data = window.LmsData;
        const upserts = {};
        const deletes = {};
        const meta = {};
        SYNC_COLLECTIONS.forEach(coll => {
            const local = data[coll];
            if (!Array.isArray(local)) return;
            const snap = this.snap[coll] = this.snap[coll] || {};
            const seen = new Set();
            local.forEach(rec => {
                if (!rec || !rec.id) return;
                seen.add(rec.id);
                const h = recordHash(coll, rec);
                let send = snap[rec.id] !== h;
                let payload = rec;
                let ph;
                if (coll === 'users') {
                    ph = rec.password ? hashString(rec.password) : undefined;
                    if (ph && this.pw[rec.id] !== ph) {
                        send = true;
                    } else if ('password' in rec) {
                        payload = { ...rec };
                        delete payload.password;
                    }
                }
                if (send) {
                    (upserts[coll] = upserts[coll] || []).push(payload);
                    (meta[coll] = meta[coll] || {})[rec.id] = { h, ph };
                }
            });
            Object.keys(snap).forEach(id => {
                if (!seen.has(id)) (deletes[coll] = deletes[coll] || []).push(id);
            });
        });
        return { upserts, deletes, meta };
    },

    async push() {
        if (!localStorage.getItem('JAMIA_CURRENT_USER_ID')) return;
        // Previewing a role: nothing is sent (the local copy is discarded when the preview ends)
        if (this.readOnly) return;
        const { upserts, deletes, meta } = this.computePush();
        if (!Object.keys(upserts).length && !Object.keys(deletes).length) return;

        const res = await fetch('/api/store/sync', {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify({ upserts, deletes })
        });
        await this.checkAuth(res);
        if (!res.ok) throw new Error(`push failed (${res.status})`);
        const out = await res.json();
        this.online = true;

        let passwordsSent = false;
        Object.entries(out.accepted || {}).forEach(([coll, ids]) => {
            const snap = this.snap[coll] = this.snap[coll] || {};
            ids.forEach(id => {
                const m = meta[coll] && meta[coll][id];
                if (m) {
                    snap[id] = m.h;
                    if (coll === 'users' && m.ph) {
                        // The server keeps only a hash; never leave the password in this browser's storage
                        const rec = (window.LmsData.users || []).find(u => u.id === id);
                        if (rec) delete rec.password;
                        delete this.pw[id];
                        passwordsSent = true;
                    }
                } else {
                    delete snap[id]; // accepted delete
                }
            });
        });
        if (passwordsSent) {
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(window.LmsData)); } catch (e) { /* storage full */ }
        }
        // Explain refusals the person can act on (e.g. a password that is too short, an email already in use)
        const messages = [];
        Object.values(out.errors || {}).forEach(byId => Object.values(byId).forEach(msg => messages.push(msg)));
        if (messages.length && window.App && window.App.showToast) {
            window.App.showToast(`Not saved: ${[...new Set(messages)].join(' ')}`, 'danger');
        }
        let rejectedAny = false;
        Object.entries(out.rejected || {}).forEach(([coll, ids]) => {
            ids.forEach(id => {
                rejectedAny = true;
                if (this.snap[coll]) delete this.snap[coll][id];
                if (coll === 'users') {
                    // A refused password is not retried; the administrator sets a valid one again
                    const rec = (window.LmsData.users || []).find(u => u.id === id);
                    if (rec) delete rec.password;
                    delete this.pw[id];
                }
                (this.rejected[coll] = this.rejected[coll] || new Set()).add(id);
            });
            console.warn(`[Sync] Server rejected changes to ${coll}:`, ids);
        });
        if (rejectedAny) this.forceFull = true;
        this.saveState();
    },

    async cycle(pullFirst) {
        try {
            if (pullFirst) {
                await this.pull(true);
                await this.push();
            } else {
                await this.push();
                const full = this.forceFull || (Date.now() - this.lastFullAt > 5 * 60 * 1000);
                this.forceFull = false;
                await this.pull(full);
            }
        } catch (err) {
            this.online = false;
            console.warn('[Sync] offline, changes kept locally:', err.message);
        }
    },

    schedulePush() {
        if (!this.enabled) return;
        clearTimeout(this.pushTimer);
        this.pushTimer = setTimeout(() => this.enqueue(() => this.push().catch(err => {
            this.online = false;
            console.warn('[Sync] push deferred:', err.message);
        })), 400);
    },

    async start() {
        if (this.enabled) return;
        this.enabled = true;
        this.loadState();
        const initial = this.enqueue(() => this.cycle(true));
        // Don't block the UI for long if the server is slow or offline
        await Promise.race([initial, new Promise(r => setTimeout(r, 6000))]);
        setInterval(() => {
            if (document.visibilityState === 'visible') this.enqueue(() => this.cycle(false));
        }, 15000);
        window.addEventListener('focus', () => this.enqueue(() => this.cycle(false)));
    }
};

const DataStore = {
    get() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                let dirty = migrateData(parsed);

                // Guarantee roles array exists
                if (!parsed.roles || parsed.roles.length === 0) {
                    parsed.roles = clone(INITIAL_DATA.roles);
                    dirty = true;
                }

                // Guarantee attendance array exists
                if (!Array.isArray(parsed.attendance)) {
                    parsed.attendance = clone(INITIAL_DATA.attendance);
                    dirty = true;
                }

                // Guarantee user directory exists (records themselves come from the server once synced)
                if (!Array.isArray(parsed.users) || parsed.users.length === 0) {
                    parsed.users = clone(INITIAL_DATA.users);
                    dirty = true;
                } else {
                    parsed.users.forEach(u => {
                        if (!u.status) { u.status = 'ACTIVE'; dirty = true; }
                    });
                }

                if (!Array.isArray(parsed.virtualClasses)) {
                    parsed.virtualClasses = clone(INITIAL_DATA.virtualClasses);
                    dirty = true;
                }
                if (!Array.isArray(parsed.virtualClassRecordings)) {
                    parsed.virtualClassRecordings = clone(INITIAL_DATA.virtualClassRecordings);
                    dirty = true;
                }
                if (!parsed.virtualClassSettings) {
                    parsed.virtualClassSettings = clone(INITIAL_DATA.virtualClassSettings);
                    dirty = true;
                }

                // Guarantee admissions items have studentType, country, and seed items
                if (!parsed.admissions || parsed.admissions.length === 0) {
                    parsed.admissions = clone(INITIAL_DATA.admissions);
                    dirty = true;
                } else {
                    parsed.admissions.forEach(a => {
                        if (!a.studentType) {
                            a.studentType = (a.passport && !a.cnic) ? 'INTERNATIONAL' : 'LOCAL';
                            dirty = true;
                        }
                        if (!a.country) {
                            a.country = a.studentType === 'INTERNATIONAL' ? 'International' : 'Pakistan';
                            dirty = true;
                        }
                    });
                }

                if (dirty) {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
                }
                return parsed;
            } catch (e) {
                console.error("Failed to parse stored LMS data, resetting to initial", e);
            }
        }
        const fresh = clone(INITIAL_DATA);
        fresh.schemaVersion = DATA_SCHEMA_VERSION;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
        return fresh;
    },

    save(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('[DataStore] Could not save locally:', e);
            if (window.App && window.App.showToast) {
                window.App.showToast('Browser storage is full. Changes are being saved to the server only.', 'warning');
            }
        }
        SyncEngine.schedulePush();
    },

    reset() {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(SYNC_STATE_KEY);
        return this.get();
    },

    // Forgets everything this browser cached, so the next person on a shared computer starts from
    // only what the server shares with them. Called at sign-in and sign-out.
    clearLocal() {
        clearTimeout(SyncEngine.pushTimer);
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(SYNC_STATE_KEY);
        localStorage.setItem(FRESH_SESSION_KEY, '1');
        SyncEngine.since = null;
        SyncEngine.snap = {};
        SyncEngine.pw = {};
        window.LmsData = this.get();
        return window.LmsData;
    },

    // Starts multi-user sync (called once the portal has loaded)
    startSync() {
        return SyncEngine.start();
    },

    // Push pending changes and fetch everyone else's right now
    syncNow() {
        clearTimeout(SyncEngine.pushTimer);
        return SyncEngine.enqueue(() => SyncEngine.cycle(false));
    },

    // While a Super Admin previews a role, changes stay in this browser and are never sent
    setReadOnly(on) {
        SyncEngine.readOnly = !!on;
    },

    isOnline() {
        return SyncEngine.online;
    }
};

window.LmsData = DataStore.get();
window.DataStore = DataStore;
window.SYNC_COLLECTIONS = SYNC_COLLECTIONS;
