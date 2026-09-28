/**
 * JAMIA ASHRAFIA LAHORE - CLOUD LMS DATA STORE
 * Authentic Institutional Seed Data & LocalStorage Persistence Engine
 * History Source: Wikipedia & Institutional Archives (Est. 1947 by Mufti Muhammad Hassan)
 */

const STORAGE_KEY = 'JAMIA_ASHRAFIA_LMS_DATA_V1';

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
            name: "Academic Nazim",
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
            isSystem: true,
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
            password: "admin123",
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
            password: "nazim123",
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
            assignedCourses: ["c_bukhari_1", "c_tirmidhi"]
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
        { id: "cls_dawra_a", name: "Dawra-e-Hadith (Alimiyyah Final)", section: "Section A (Hall Imam Bukhari)", programId: "p1", branchId: "b1", enrolledCount: 68, teacherId: "u_teacher_1" },
        { id: "cls_dawra_b", name: "Dawra-e-Hadith (Alimiyyah Final)", section: "Section B (Hall Imam Muslim)", programId: "p1", branchId: "b1", enrolledCount: 64, teacherId: "u_teacher_1" },
        { id: "cls_aaliyah", name: "Aaliyah (7th Year)", section: "Section A", programId: "p1", branchId: "b1", enrolledCount: 52, teacherId: "u_teacher_2" },
        { id: "cls_ifta", name: "Takhassus fil-Ifta (1st Year)", section: "Darul Ifta Seminar Room", programId: "p2", branchId: "b1", enrolledCount: 22, teacherId: "u_teacher_2" },
        { id: "cls_hifz_3", name: "Hifz-ul-Quran (Daur-e-Kamil)", section: "Room 102", programId: "p3", branchId: "b1", enrolledCount: 30, teacherId: "u_teacher_1" }
    ],

    admissions: [
        {
            id: "adm_101",
            applicationNo: "ASH-ADM-2024-089",
            name: "Ahmad Raza Siddiqui",
            fatherName: "Maulana Muhammad Siddique",
            cnic: "35201-8934521-3",
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
            name: "Zubair Ahmad Qasmi",
            fatherName: "Hafiz Abdul Qadir",
            cnic: "38403-1249872-5",
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
            name: "Zainab Bint Tariq",
            fatherName: "Tariq Mahmood",
            cnic: "35202-6721980-6",
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
            name: "Abdullah Haroon",
            fatherName: "Haroon Rashid",
            cnic: "37405-5544123-1",
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
            totalSubmissions: 64,
            gradedSubmissions: 58
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
            totalSubmissions: 22,
            gradedSubmissions: 19
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
            attachmentUrl: "submissions/talha_bukhari_niyyah_tahqiq.pdf",
            submittedAt: "2026-10-02 04:30 PM",
            isGraded: true,
            marksObtained: 48,
            feedback: "Mumtaz! Thorough takhrij with exceptional references to Fath al-Bari and Umdat al-Qari. Baraka Allahu feek."
        }
    ],

    exams: [
        {
            id: "ex_1",
            title: "Shashmahi Examination 1446 AH: Sahih al-Bukhari",
            urduTitle: "امتحان ششماہی: صحیح البخاری",
            examType: "SHASHMAHI_MIDTERM",
            classId: "cls_dawra_a",
            courseId: "c_bukhari_1",
            examDate: "2026-10-15",
            startTime: "08:30 AM",
            durationMinutes: 180,
            totalMarks: 100,
            passingMarks: 40,
            session: "1446-1447 AH / 2026-2027 CE"
        },
        {
            id: "ex_2",
            title: "Annual Board Mock Examination: Al-Hidayah",
            urduTitle: "امتحان سالانہ: الہدایہ شریف",
            examType: "SALANA_FINAL",
            classId: "cls_aaliyah",
            courseId: "c_hidayah",
            examDate: "2026-10-18",
            startTime: "08:30 AM",
            durationMinutes: 180,
            totalMarks: 100,
            passingMarks: 40,
            session: "1446-1447 AH / 2026-2027 CE"
        }
    ],

    examResults: [
        {
            id: "res_1",
            examId: "ex_1",
            studentId: "u_student_1",
            studentName: "Muhammad Talha Usmani",
            rollNo: "ASH-2024-001",
            marksObtained: 92.5,
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
            wifaqGrade: "MUMTAZ",
            urduGrade: "ممتاز (Excellent)",
            examinerRemarks: "Sound logical deduction with strong Hanafi Usul grounding.",
            sanadNumber: "ASH-SANAD-1446-1044"
        }
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

    timetables: [
        { id: "tt_1", day: "Monday", period: 1, time: "06:30 AM - 08:00 AM", periodName: "Fajr Dars", courseId: "c_bukhari_1", teacher: "Qari Arshad Ubaid", room: "Hall Imam Bukhari", classId: "cls_dawra_a" },
        { id: "tt_2", day: "Monday", period: 2, time: "08:15 AM - 09:45 AM", periodName: "Sabq 2", courseId: "c_tirmidhi", teacher: "Qari Arshad Ubaid", room: "Hall Imam Bukhari", classId: "cls_dawra_a" },
        { id: "tt_3", day: "Monday", period: 3, time: "10:15 AM - 11:45 AM", periodName: "Chai / Sabq 3", courseId: "c_hidayah", teacher: "Mufti Ahmadur Rahman", room: "Room 201", classId: "cls_aaliyah" },
        { id: "tt_4", day: "Monday", period: 4, time: "12:15 PM - 02:00 PM", periodName: "Namaz-e-Zuhr, Khana & Qailulah", courseId: null, teacher: "All Campus", room: "Grand Jamia Mosque", classId: "all" },
        { id: "tt_5", day: "Monday", period: 5, time: "02:15 PM - 03:45 PM", periodName: "Asr Dars", courseId: "c_banking", teacher: "Mufti Ahmadur Rahman", room: "Darul Ifta Conference Room", classId: "cls_ifta" }
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
            courseId: "c_bukhari_1",
            scheduledStart: "2026-09-28 11:00 AM",
            durationMinutes: 60,
            passcode: "ASHRAFIA1947",
            isLive: true,
            activeParticipants: 42,
            recordingStatus: "RECORDING_ACTIVE"
        },
        {
            id: "vc_102",
            meetingUuid: "ASH-ZOOM-451-870-221",
            title: "Online Seminar: Contemporary Islamic Contracts & Cryptocurrency Rulings",
            urduTitle: "فقہی سیمینار: جدید مالیاتی معاملات اور ڈیجیٹل کرنسی کا شرعی حکم",
            hostTeacher: "Mufti Ahmadur Rahman (Darul Ifta)",
            hostId: "u_teacher_2",
            classId: "cls_ifta",
            courseId: "c_banking",
            scheduledStart: "2026-09-28 03:00 PM",
            durationMinutes: 90,
            passcode: "IFTA2026",
            isLive: false,
            activeParticipants: 0,
            recordingStatus: "SCHEDULED"
        }
    ],

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

    // Granular Module Availability per Role (Configurable by Super Admin)
    roleModulePermissions: {
        STUDENT: {
            classes: true,
            assignments: true,
            exams: true,
            timetable: true,
            virtual_class: true,
            notifications: true,
            library: true,
            attendance: true,
            students: false,
            reports: false,
            users: false,
            roles: false,
            admissions: false,
            teachers: false,
            fees: false,
            heritage: true,
            permissions: false,
            security: false
        },
        TEACHER: {
            classes: true,
            assignments: true,
            exams: true,
            timetable: true,
            virtual_class: true,
            notifications: true,
            library: true,
            teachers: true,
            students: true,
            attendance: true,
            reports: false,
            users: false,
            roles: false,
            admissions: false,
            fees: false,
            heritage: true,
            permissions: false,
            security: false
        },
        ACADEMIC_ADMIN: {
            classes: true,
            assignments: true,
            exams: true,
            timetable: true,
            virtual_class: true,
            notifications: true,
            library: true,
            teachers: true,
            students: true,
            attendance: true,
            reports: true,
            users: false,
            roles: false,
            admissions: true,
            fees: false,
            heritage: true,
            permissions: false,
            security: false
        },
        ACCOUNTANT: {
            classes: false,
            assignments: false,
            exams: false,
            timetable: false,
            virtual_class: false,
            notifications: true,
            library: false,
            teachers: false,
            students: false,
            attendance: true,
            reports: true,
            users: false,
            roles: false,
            admissions: false,
            fees: true,
            heritage: true,
            permissions: false,
            security: false
        },
        SUPER_ADMIN: {
            classes: true,
            assignments: true,
            exams: true,
            timetable: true,
            virtual_class: true,
            notifications: true,
            library: true,
            admissions: true,
            teachers: true,
            students: true,
            attendance: true,
            reports: true,
            users: true,
            roles: true,
            fees: true,
            heritage: true,
            permissions: true,
            security: true
        }
    }
};

// DATA STORE CONTROLLER
const DataStore = {
    get() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                let dirty = false;

                // Guarantee roles array exists
                if (!parsed.roles || parsed.roles.length === 0) {
                    parsed.roles = JSON.parse(JSON.stringify(INITIAL_DATA.roles));
                    dirty = true;
                }

                // Guarantee roleModulePermissions is complete
                if (!parsed.roleModulePermissions) {
                    parsed.roleModulePermissions = JSON.parse(JSON.stringify(INITIAL_DATA.roleModulePermissions));
                    dirty = true;
                } else {
                    // Guarantee SUPER_ADMIN retains full permissions permanently
                    if (!parsed.roleModulePermissions.SUPER_ADMIN) {
                        parsed.roleModulePermissions.SUPER_ADMIN = {};
                    }
                    Object.keys(INITIAL_DATA.roleModulePermissions.SUPER_ADMIN).forEach(m => {
                        if (parsed.roleModulePermissions.SUPER_ADMIN[m] !== true) {
                            parsed.roleModulePermissions.SUPER_ADMIN[m] = true;
                            dirty = true;
                        }
                    });

                    // Guarantee all configurable roles have permission definitions
                    (parsed.roles || []).forEach(r => {
                        if (!parsed.roleModulePermissions[r.id]) {
                            parsed.roleModulePermissions[r.id] = INITIAL_DATA.roleModulePermissions[r.id] 
                                ? JSON.parse(JSON.stringify(INITIAL_DATA.roleModulePermissions[r.id]))
                                : {
                                    classes: true,
                                    assignments: false,
                                    exams: false,
                                    timetable: true,
                                    virtual_class: false,
                                    notifications: true,
                                    library: true,
                                    attendance: true,
                                    students: false,
                                    reports: false,
                                    users: false,
                                    roles: false,
                                    admissions: false,
                                    teachers: false,
                                    fees: false,
                                    heritage: true,
                                    permissions: false,
                                    security: false
                                };
                            dirty = true;
                        }
                    });
                }

                // Guarantee attendance array exists
                if (!parsed.attendance || parsed.attendance.length === 0) {
                    parsed.attendance = JSON.parse(JSON.stringify(INITIAL_DATA.attendance));
                    dirty = true;
                }

                // Guarantee user properties
                if (!parsed.users || parsed.users.length < INITIAL_DATA.users.length) {
                    parsed.users = JSON.parse(JSON.stringify(INITIAL_DATA.users));
                    dirty = true;
                } else {
                    parsed.users.forEach(u => {
                        if (!u.status) { u.status = 'ACTIVE'; dirty = true; }
                        if (!u.password) { u.password = 'ashrafia123'; dirty = true; }
                    });
                }

                if (dirty) {
                    this.save(parsed);
                }
                return parsed;
            } catch (e) {
                console.error("Failed to parse stored LMS data, resetting to initial", e);
            }
        }
        this.save(INITIAL_DATA);
        return JSON.parse(JSON.stringify(INITIAL_DATA));
    },

    save(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    },

    reset() {
        localStorage.removeItem(STORAGE_KEY);
        return this.get();
    }
};

window.LmsData = DataStore.get();
window.DataStore = DataStore;
