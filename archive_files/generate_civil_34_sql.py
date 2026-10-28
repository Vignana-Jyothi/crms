import json

data = {
    "department_id": 31,
    "academic_year": "2026-27",
    "years": {
        "3": {
            "A": {
                "theory_room": "D-105",
                "courses": {
                    "DRCS": {"name": "Design of Reinforced Concrete Structures", "code": "22PC1CE301", "faculty": "Mrs. A. Jyothirmai", "room": "D-105"},
                    "WRE": {"name": "Water Resources Engineering", "code": "22PC1CE302", "faculty": "Dr. P Z Seenu", "room": "D-105"},
                    "E&C": {"name": "Estimation and Costing", "code": "22PC1CE303", "faculty": "Dr. Arti Sudam", "room": "D-105"},
                    "PE-1": {"name": "Pavement Analysis and Design", "code": "22PE1CE301", "faculty": "Dr. A. Ramesh", "room": "D-112"},
                    "OE-I": {"name": "Open Elective-I", "code": "", "faculty": "See Open Elective List", "room": "Multiple"},
                    "OE-1": {"name": "Open Elective-I", "code": "", "faculty": "See Open Elective List", "room": "Multiple"},
                    "EG LAB": {"name": "Engineering Geology Lab", "code": "22PC2CE311", "faculty": "Dr. Arti Sudam / Dr. JYV Shiva Bhushan", "room": "D-009"},
                    "IDACE LAB": {"name": "Introduction to Data Analytics for Civil Engineers", "code": "22SD5CE301", "faculty": "Dr. K. Ravi Kumar / Mr. G. Samba Siva Rao / Dr. D. Harinder", "room": "D-215"},
                    "AW": {"name": "Ancient Wisdom Leading Edge Technologies and Modern Living", "code": "22MN6HS301", "faculty": "Dr. Sailaja Simma / Mrs. R. Harika", "room": "KS Auditorium"},
                    "AECS LAB BATCH-1": {"name": "Advanced English Communication Skills Laboratory", "code": "22HS2EN301", "faculty": "Dr. Somrwita Ghosh", "room": "D-507"},
                    "AECS LAB BATCH-2": {"name": "Advanced English Communication Skills Laboratory", "code": "22HS2EN301", "faculty": "Dr. Sudha Rani", "room": "D-506"},
                    "MENTORING": {"name": "Mentoring", "code": "", "faculty": "Mentors", "room": "D-105"},
                    "ECA/CCA": {"name": "ECA/CCA", "code": "", "faculty": "Staff", "room": "D-105"},
                    "SPORTS": {"name": "Sports", "code": "", "faculty": "Staff", "room": "Ground"},
                    "LIBRARY": {"name": "Library", "code": "", "faculty": "Librarian", "room": "Library"}
                },
                "schedule": {
                    "Monday": [
                        {"start": "10:00:00", "end": "12:00:00", "subject": "DRCS"},
                        {"start": "12:00:00", "end": "13:00:00", "subject": "E&C"},
                        {"start": "13:40:00", "end": "14:40:00", "subject": "PE-1"},
                        {"start": "14:40:00", "end": "16:40:00", "subject": "OE-I"}
                    ],
                    "Tuesday": [
                        {"start": "10:00:00", "end": "11:00:00", "subject": "PE-1"},
                        {"start": "11:00:00", "end": "13:00:00", "subject": "IDACE LAB"},
                        {"start": "13:40:00", "end": "14:40:00", "subject": "DRCS"},
                        {"start": "14:40:00", "end": "15:40:00", "subject": "WRE"},
                        {"start": "15:40:00", "end": "16:40:00", "subject": "E&C"}
                    ],
                    "Wednesday": [
                        {"start": "10:00:00", "end": "11:00:00", "subject": "WRE"},
                        {"start": "11:00:00", "end": "13:00:00", "subject": "AW"},
                        {"start": "13:40:00", "end": "16:40:00", "subject": "AECS LAB BATCH-1 / EG LAB"}
                    ],
                    "Thursday": [
                        {"start": "10:00:00", "end": "11:00:00", "subject": "E&C"},
                        {"start": "11:00:00", "end": "12:00:00", "subject": "WRE"},
                        {"start": "12:00:00", "end": "13:00:00", "subject": "DRCS"},
                        {"start": "13:40:00", "end": "14:40:00", "subject": "WRE"},
                        {"start": "14:40:00", "end": "15:40:00", "subject": "MENTORING"},
                        {"start": "15:40:00", "end": "16:40:00", "subject": "ECA/CCA"}
                    ],
                    "Friday": [
                        {"start": "10:00:00", "end": "13:00:00", "subject": "AECS LAB BATCH-2 / EG LAB"},
                        {"start": "13:40:00", "end": "14:40:00", "subject": "PE-1"},
                        {"start": "14:40:00", "end": "15:40:00", "subject": "E&C"},
                        {"start": "15:40:00", "end": "16:40:00", "subject": "SPORTS"}
                    ],
                    "Saturday": [
                        {"start": "10:00:00", "end": "11:00:00", "subject": "OE-1"},
                        {"start": "11:00:00", "end": "12:00:00", "subject": "PE-1"},
                        {"start": "12:00:00", "end": "13:00:00", "subject": "E&C"},
                        {"start": "13:40:00", "end": "14:40:00", "subject": "WRE"},
                        {"start": "14:40:00", "end": "15:40:00", "subject": "DRCS"},
                        {"start": "15:40:00", "end": "16:40:00", "subject": "LIBRARY"}
                    ]
                }
            },
            "B": {
                "theory_room": "D-116",
                "courses": {
                    "DRCS": {"name": "Design of Reinforced Concrete Structures", "code": "22PC1CE301", "faculty": "Dr. B. Murali Krishna", "room": "D-116"},
                    "WRE": {"name": "Water Resources Engineering", "code": "22PC1CE302", "faculty": "Dr. K. Ravi Kumar", "room": "D-116"},
                    "E&C": {"name": "Estimation and Costing", "code": "22PC1CE303", "faculty": "Dr. Sangeetha S.", "room": "D-116"},
                    "PE-1": {"name": "Pavement Analysis and Design", "code": "22PE1CE301", "faculty": "Dr. A. Ramesh", "room": "D-112"},
                    "OE-1": {"name": "Open Elective-I", "code": "", "faculty": "See Open Elective List", "room": "Multiple"},
                    "EG LAB": {"name": "Engineering Geology Lab", "code": "22PC2CE311", "faculty": "Dr. K. Suresh / Dr. Priyam Nath Bhowmik", "room": "D-009"},
                    "IDACE LAB": {"name": "Introduction to Data Analytics for Civil Engineers", "code": "22SD5CE301", "faculty": "Dr. K. Ravi Kumar / Mrs. V. Ramya Krishna / Mr. G. Samba Siva Rao", "room": "D-215"},
                    "AW": {"name": "Ancient Wisdom Leading Edge Technologies and Modern Living", "code": "22MN6HS301", "faculty": "Dr. Sailaja Simma / Mrs. R. Harika", "room": "KS Auditorium"},
                    "AECS LAB BATCH-1": {"name": "Advanced English Communication Skills Laboratory", "code": "22HS2EN301", "faculty": "Dr. Rachel Irdaya Raj", "room": "D-506"},
                    "AECS LAB BATCH-2": {"name": "Advanced English Communication Skills Laboratory", "code": "22HS2EN301", "faculty": "Ms. D. Divya", "room": "D-510"},
                    "MENTORING": {"name": "Mentoring", "code": "", "faculty": "Mentors", "room": "D-116"},
                    "ECA/CCA": {"name": "ECA/CCA", "code": "", "faculty": "Staff", "room": "D-116"},
                    "SPORTS": {"name": "Sports", "code": "", "faculty": "Staff", "room": "Ground"},
                    "LIBRARY": {"name": "Library", "code": "", "faculty": "Librarian", "room": "Library"}
                },
                "schedule": {
                    "Monday": [
                        {"start": "10:00:00", "end": "13:00:00", "subject": "EG LAB / AECS LAB BATCH-2"},
                        {"start": "13:40:00", "end": "14:40:00", "subject": "PE-1"},
                        {"start": "14:40:00", "end": "16:40:00", "subject": "OE-1"}
                    ],
                    "Tuesday": [
                        {"start": "10:00:00", "end": "11:00:00", "subject": "PE-1"},
                        {"start": "11:00:00", "end": "13:00:00", "subject": "DRCS"},
                        {"start": "13:40:00", "end": "14:40:00", "subject": "WRE"},
                        {"start": "14:40:00", "end": "15:40:00", "subject": "E&C"},
                        {"start": "15:40:00", "end": "16:40:00", "subject": "LIBRARY"}
                    ],
                    "Wednesday": [
                        {"start": "10:00:00", "end": "11:00:00", "subject": "E&C"},
                        {"start": "11:00:00", "end": "13:00:00", "subject": "AW"},
                        {"start": "13:40:00", "end": "14:40:00", "subject": "DRCS"},
                        {"start": "14:40:00", "end": "15:40:00", "subject": "MENTORING"},
                        {"start": "15:40:00", "end": "16:40:00", "subject": "ECA/CCA"}
                    ],
                    "Thursday": [
                        {"start": "10:00:00", "end": "11:00:00", "subject": "WRE"},
                        {"start": "11:00:00", "end": "13:00:00", "subject": "E&C"},
                        {"start": "13:40:00", "end": "16:40:00", "subject": "EG LAB / AECS LAB BATCH-1"}
                    ],
                    "Friday": [
                        {"start": "10:00:00", "end": "11:00:00", "subject": "E&C"},
                        {"start": "11:00:00", "end": "13:00:00", "subject": "WRE"},
                        {"start": "13:40:00", "end": "14:40:00", "subject": "PE-1"},
                        {"start": "14:40:00", "end": "15:40:00", "subject": "DRCS"},
                        {"start": "15:40:00", "end": "16:40:00", "subject": "SPORTS"}
                    ],
                    "Saturday": [
                        {"start": "10:00:00", "end": "11:00:00", "subject": "OE-1"},
                        {"start": "11:00:00", "end": "12:00:00", "subject": "PE-1"},
                        {"start": "12:00:00", "end": "13:00:00", "subject": "WRE"},
                        {"start": "13:40:00", "end": "15:40:00", "subject": "IDACE LAB"},
                        {"start": "15:40:00", "end": "16:40:00", "subject": "LIBRARY"}
                    ]
                }
            }
        },
        "4": {
            "A": {
                "theory_room": "D-104/1",
                "courses": {
                    "FE": {"name": "Foundation Engineering", "code": "22PC1CE401", "faculty": "Dr. K. Suresh", "room": "D-104/1"},
                    "I&E": {"name": "Innovation and Entrepreneurship", "code": "22PC1CE402", "faculty": "Dr. M. V. Narasimha Rao", "room": "D-104/1"},
                    "CTPM": {"name": "Construction Technology and Project Management", "code": "22PE1CE405", "faculty": "Dr. J. Y. V. Shiva Bhushan", "room": "D-104/1"},
                    "PE-IV": {"name": "PE-IV (NPTEL)", "code": "", "faculty": "Mr. P. V. S. Gopi Raghunadh / Dr. PZ Seenu", "room": "D-104/1"},
                    "OE-III": {"name": "Open Elective-III", "code": "", "faculty": "See Open Elective List", "room": "Multiple"},
                    "CAD STUDIO LAB": {"name": "Computer Aided Design Studio", "code": "22PC2CE411", "faculty": "Dr. B. Murali Krishna / Dr. K. Pardhasaradhi / Dr. K. Ravi Kumar / Dr. T. Srinivas Rao", "room": "D-215"},
                    "EE LAB": {"name": "Environmental Engineering Laboratory", "code": "22PC2CE306", "faculty": "Mr. P. V. S. Gopi Raghunadh / Mrs. V. Ramya Krishna", "room": "D-010"},
                    "Project-1": {"name": "Major Project Phase-I", "code": "22PW4CE401", "faculty": "Major Project Supervisors", "room": "D-104/1"},
                    "LIBRARY": {"name": "Library", "code": "", "faculty": "Librarian", "room": "Library"},
                    "MENTORING": {"name": "Mentoring", "code": "", "faculty": "Mentors", "room": "D-104/1"},
                    "CORE TRAININGS": {"name": "Core Trainings", "code": "", "faculty": "Trainers", "room": "D-104/1"}
                },
                "schedule": {
                    "Monday": [
                        {"start": "10:00:00", "end": "11:00:00", "subject": "PE-IV"},
                        {"start": "11:00:00", "end": "12:00:00", "subject": "I&E"},
                        {"start": "12:00:00", "end": "13:00:00", "subject": "CTPM"},
                        {"start": "13:40:00", "end": "14:40:00", "subject": "FE"},
                        {"start": "14:40:00", "end": "16:40:00", "subject": "Project-1"}
                    ],
                    "Tuesday": [
                        {"start": "10:00:00", "end": "12:00:00", "subject": "OE-III"},
                        {"start": "12:00:00", "end": "13:00:00", "subject": "PE-IV"},
                        {"start": "13:40:00", "end": "16:40:00", "subject": "Project-1"}
                    ],
                    "Wednesday": [
                        {"start": "10:00:00", "end": "11:00:00", "subject": "I&E"},
                        {"start": "11:00:00", "end": "12:00:00", "subject": "FE"},
                        {"start": "12:00:00", "end": "13:00:00", "subject": "CTPM"},
                        {"start": "13:40:00", "end": "16:40:00", "subject": "Project-1"}
                    ],
                    "Thursday": [
                        {"start": "10:00:00", "end": "13:00:00", "subject": "EE LAB / CAD STUDIO LAB"},
                        {"start": "13:40:00", "end": "14:40:00", "subject": "OE-III"},
                        {"start": "14:40:00", "end": "15:40:00", "subject": "CTPM"},
                        {"start": "15:40:00", "end": "16:40:00", "subject": "LIBRARY"}
                    ],
                    "Friday": [
                        {"start": "10:00:00", "end": "13:00:00", "subject": "EE LAB / CAD STUDIO LAB"},
                        {"start": "13:40:00", "end": "14:40:00", "subject": "I&E"},
                        {"start": "14:40:00", "end": "15:40:00", "subject": "FE"},
                        {"start": "15:40:00", "end": "16:40:00", "subject": "MENTORING"}
                    ],
                    "Saturday": [
                        {"start": "10:00:00", "end": "11:00:00", "subject": "CTPM"},
                        {"start": "11:00:00", "end": "12:00:00", "subject": "FE"},
                        {"start": "12:00:00", "end": "13:00:00", "subject": "PE-IV"},
                        {"start": "13:40:00", "end": "16:40:00", "subject": "Project-1 / CORE TRAININGS"}
                    ]
                }
            },
            "B": {
                "theory_room": "D-104/1",
                "courses": {
                    "FE": {"name": "Foundation Engineering", "code": "22PC1CE401", "faculty": "Dr. K. Suresh", "room": "D-104/1"},
                    "I&E": {"name": "Innovation and Entrepreneurship", "code": "22PC1CE402", "faculty": "Dr. M. V. Narasimha Rao", "room": "D-104/1"},
                    "CTPM": {"name": "Construction Technology and Project Management", "code": "22PE1CE405", "faculty": "Dr. J. Y. V. Shiva Bhushan", "room": "D-104/1"},
                    "PE-IV": {"name": "PE-IV (NPTEL)", "code": "", "faculty": "Mrs. J. Soujanya / Dr. PZ Seenu", "room": "D-104/1"},
                    "OE-III": {"name": "Open Elective-III", "code": "", "faculty": "See Open Elective List", "room": "Multiple"},
                    "CAD STUDIO LAB": {"name": "Computer Aided Design Studio", "code": "22PC2CE411", "faculty": "Dr. K. Ravi Kumar / Mr. K. Veerendra Gopi / Dr. K. Pardhasaradhi / Dr. B. Murali Krishna", "room": "D-215"},
                    "EE LAB": {"name": "Environmental Engineering Laboratory", "code": "22PC2CE306", "faculty": "Mrs. J. Soujanya / Dr. Sangeetha S.", "room": "D-010"},
                    "Project-1": {"name": "Major Project Phase-I", "code": "22PW4CE401", "faculty": "Major Project Supervisors", "room": "D-104/1"},
                    "LIBRARY": {"name": "Library", "code": "", "faculty": "Librarian", "room": "Library"},
                    "MENTORING": {"name": "Mentoring", "code": "", "faculty": "Mentors", "room": "D-104/1"},
                    "CORE TRAININGS": {"name": "Core Trainings", "code": "", "faculty": "Trainers", "room": "D-104/1"}
                },
                "schedule": {
                    "Monday": [
                        {"start": "10:00:00", "end": "11:00:00", "subject": "PE-IV"},
                        {"start": "11:00:00", "end": "12:00:00", "subject": "I&E"},
                        {"start": "12:00:00", "end": "13:00:00", "subject": "CTPM"},
                        {"start": "13:40:00", "end": "14:40:00", "subject": "FE"},
                        {"start": "14:40:00", "end": "16:40:00", "subject": "Project-1"}
                    ],
                    "Tuesday": [
                        {"start": "10:00:00", "end": "12:00:00", "subject": "OE-III"},
                        {"start": "12:00:00", "end": "13:00:00", "subject": "PE-IV"},
                        {"start": "13:40:00", "end": "16:40:00", "subject": "EE LAB / CAD STUDIO LAB"}
                    ],
                    "Wednesday": [
                        {"start": "10:00:00", "end": "11:00:00", "subject": "I&E"},
                        {"start": "11:00:00", "end": "12:00:00", "subject": "FE"},
                        {"start": "12:00:00", "end": "13:00:00", "subject": "CTPM"},
                        {"start": "13:40:00", "end": "16:40:00", "subject": "EE LAB / CAD STUDIO LAB"}
                    ],
                    "Thursday": [
                        {"start": "10:00:00", "end": "13:00:00", "subject": "Project-1"},
                        {"start": "13:40:00", "end": "14:40:00", "subject": "OE-III"},
                        {"start": "14:40:00", "end": "15:40:00", "subject": "CTPM"},
                        {"start": "15:40:00", "end": "16:40:00", "subject": "LIBRARY"}
                    ],
                    "Friday": [
                        {"start": "10:00:00", "end": "13:00:00", "subject": "Project-1"},
                        {"start": "13:40:00", "end": "14:40:00", "subject": "I&E"},
                        {"start": "14:40:00", "end": "15:40:00", "subject": "FE"},
                        {"start": "15:40:00", "end": "16:40:00", "subject": "MENTORING"}
                    ],
                    "Saturday": [
                        {"start": "10:00:00", "end": "11:00:00", "subject": "CTPM"},
                        {"start": "11:00:00", "end": "12:00:00", "subject": "FE"},
                        {"start": "12:00:00", "end": "13:00:00", "subject": "PE-IV"},
                        {"start": "13:40:00", "end": "16:40:00", "subject": "Project-1 / CORE TRAININGS"}
                    ]
                }
            }
        }
    }
}

sql = []

for year, sections in data["years"].items():
    for section, details in sections.items():
        for day, slots in details["schedule"].items():
            for slot in slots:
                raw_sub = slot["subject"]
                
                # handle multiple subs separated by /
                subs = [s.strip() for s in raw_sub.replace('/', '|').split('|')]
                for s in subs:
                    # remove batch/lab matching weirdness
                    s = s.replace(' BATCH-1', '').replace(' BATCH-2', '')
                    
                    course_info = details["courses"].get(s)
                    
                    # try to fuzzy match if not found directly
                    if not course_info:
                        for key in details["courses"].keys():
                            if key in s or s in key:
                                course_info = details["courses"][key]
                                break
                    
                    if not course_info:
                        # fallback
                        course_info = {"name": s, "code": "", "faculty": "Faculty", "room": details["theory_room"]}
                    
                    fac = course_info["faculty"]
                    room = course_info["room"]
                    
                    final_fac = f"Room: {room} | {fac}"
                    
                    q = f"""INSERT INTO timetable (department_id, academic_year, student_year, section, day_of_week, start_time, end_time, course_code, course_name, faculty_name, resource_id) VALUES ({data['department_id']}, '{data['academic_year']}', '{year}', '{section}', '{day.upper()}', '{slot['start']}', '{slot['end']}', '{course_info['code']}', '{course_info['name']}', '{final_fac}', NULL);"""
                    sql.append(q)

with open('civil_34_insert.sql', 'w') as f:
    f.write('\\n'.join(sql) + '\\n')
