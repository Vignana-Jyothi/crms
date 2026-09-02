import json

data = {
    "department_id": 31,
    "academic_year": "2026-27",
    "student_year": "2",
    "sections": {
        "A": {
            "theory_room": "D-102",
            "courses": {
                "P&S": {"name": "Probability and Statistics", "code": "25BS1MT201", "faculty": "Dr. G. Gangadhar", "room": "D-102"},
                "SM": {"name": "Strength of Materials", "code": "25PC1CE201", "faculty": "Dr. B. Narendra Kumar", "room": "D-102"},
                "CT": {"name": "Concrete Technology", "code": "25PC1CE202", "faculty": "Dr. G. Lalitha", "room": "D-102"},
                "FM": {"name": "Fluid Mechanics", "code": "25PC1CE203", "faculty": "Mr. K. Veerendra Gopi", "room": "D-102"},
                "CPDS": {"name": "C Programming and Data Structures", "code": "25ES1AM101", "faculty": "Dr. A. Mallika", "room": "D-102"},
                "CMT LAB": {"name": "Computational Mathematics Laboratory", "code": "25BS2MT211", "faculty": "Dr. G. Gangadhar / Mrs. A. Jyothirmai / Dr. K. Srinivas", "room": "D-215"},
                "SM LAB": {"name": "Strength of Materials Laboratory", "code": "25PC2CE201", "faculty": "Mr. P. Rama Rao / Mrs. R. Harika", "room": "D-002"},
                "CT LAB": {"name": "Concrete Laboratory", "code": "25PC2CE202", "faculty": "Dr. G. Lalitha / Mrs. A. Jyothirmai", "room": "D-008"},
                "CPDS LAB": {"name": "C Programming and Data Structures Laboratory", "code": "25ES2AM101", "faculty": "Dr. A. Mallika / Dr. PZ Seenu", "room": "D-215"},
                "AS LAB": {"name": "Digital Surveying Laboratory", "code": "25SD5CE201", "faculty": "Dr. T. Naga Teja / Mr. G. Samba Siva Rao / Dr. D. Harinder", "room": "D-003/1"},
                "H&W": {"name": "Happiness and Wellbeing", "code": "25MN6HS103", "faculty": "Dr. Sailaja Simma / Mrs. R. Harika", "room": "KS AUDI"}
            },
            "schedule": {
                "Monday": [
                    {"start": "10:00:00", "end": "11:00:00", "subject": "CPDS"},
                    {"start": "11:00:00", "end": "13:00:00", "subject": "CPDS LAB"},
                    {"start": "13:40:00", "end": "14:40:00", "subject": "P&S"},
                    {"start": "14:40:00", "end": "16:40:00", "subject": "CMT LAB"}
                ],
                "Tuesday": [
                    {"start": "10:00:00", "end": "11:00:00", "subject": "P&S"},
                    {"start": "11:00:00", "end": "12:00:00", "subject": "CPDS"},
                    {"start": "12:00:00", "end": "13:00:00", "subject": "FM"},
                    {"start": "13:40:00", "end": "14:40:00", "subject": "SM"},
                    {"start": "14:40:00", "end": "15:40:00", "subject": "CT"},
                    {"start": "15:40:00", "end": "16:40:00", "subject": "P&S"}
                ],
                "Wednesday": [
                    {"start": "10:00:00", "end": "11:00:00", "subject": "FM"},
                    {"start": "11:00:00", "end": "13:00:00", "subject": "AS LAB-1/CT LAB-2"},
                    {"start": "13:40:00", "end": "14:40:00", "subject": "CPDS"},
                    {"start": "14:40:00", "end": "16:40:00", "subject": "H&W"}
                ],
                "Thursday": [
                    {"start": "10:00:00", "end": "11:00:00", "subject": "SM"},
                    {"start": "11:00:00", "end": "13:00:00", "subject": "AS LAB-2/SM LAB-1"},
                    {"start": "13:40:00", "end": "14:40:00", "subject": "FM"},
                    {"start": "14:40:00", "end": "16:40:00", "subject": "CPDS LAB"}
                ],
                "Friday": [
                    {"start": "10:00:00", "end": "11:00:00", "subject": "FM"},
                    {"start": "11:00:00", "end": "12:00:00", "subject": "CPDS"},
                    {"start": "12:00:00", "end": "13:00:00", "subject": "SM"},
                    {"start": "13:40:00", "end": "14:40:00", "subject": "CT"},
                    {"start": "14:40:00", "end": "16:40:00", "subject": "CT LAB-1 /SM LAB-2"}
                ],
                "Saturday": [
                    {"start": "10:00:00", "end": "11:00:00", "subject": "CPDS"},
                    {"start": "11:00:00", "end": "12:00:00", "subject": "SM"},
                    {"start": "12:00:00", "end": "13:00:00", "subject": "CT"},
                    {"start": "13:40:00", "end": "14:40:00", "subject": "P&S"},
                    {"start": "14:40:00", "end": "15:40:00", "subject": "FM"},
                    {"start": "15:40:00", "end": "16:40:00", "subject": "CT"}
                ]
            }
        },
        "B": {
            "theory_room": "D-103",
            "courses": {
                "P&S": {"name": "Probability and Statistics", "code": "25BS1MT201", "faculty": "Dr. G. Gangadhar", "room": "D-103"},
                "SM": {"name": "Strength of Materials", "code": "25PC1CE201", "faculty": "Dr. S. Rakesh", "room": "D-103"},
                "CT": {"name": "Concrete Technology", "code": "25PC1CE202", "faculty": "Dr. D. Praseeda", "room": "D-103"},
                "FM": {"name": "Fluid Mechanics", "code": "25PC1CE203", "faculty": "Mr. K. Veerendra Gopi", "room": "D-103"},
                "CPDS": {"name": "C Programming and Data Structures", "code": "25ES1AM101", "faculty": "Dr. T. Srinivasa Rao", "room": "D-103"},
                "CMT LAB": {"name": "Computational Mathematics Laboratory", "code": "25BS2MT211", "faculty": "Dr. G. Gangadhar / Mrs. A. Jyothirmai / Dr. K. Srinivas", "room": "D-215"},
                "SM LAB": {"name": "Strength of Materials Laboratory", "code": "25PC2CE201", "faculty": "Dr. S. Rakesh / Mrs. T. Bhavani Chowdary", "room": "D-002"},
                "CT LAB": {"name": "Concrete Laboratory", "code": "25PC2CE202", "faculty": "Dr. D. Praseeda / Mr. P. Rama Rao", "room": "D-008"},
                "CPDS LAB": {"name": "C Programming and Data Structures Laboratory", "code": "25ES2AM101", "faculty": "Dr. T. Srinivasa Rao / Dr. PZ Seenu", "room": "D-215"},
                "AS LAB": {"name": "Digital Surveying Laboratory", "code": "25SD5CE201", "faculty": "Dr. S. Sangeetha / Dr. K. Sai Sahitya / Mr. K. Veerendra Gopi", "room": "D-003/1"},
                "H&W": {"name": "Happiness and Wellbeing", "code": "25MN6HS103", "faculty": "Dr. Sailaja Simma / Mrs. R. Harika", "room": "KS AUDI"},
                "TRAINING": {"name": "TRAINING", "code": "", "faculty": "Dr. G. Gangadhar", "room": "D-103"}
            },
            "schedule": {
                "Monday": [
                    {"start": "10:00:00", "end": "11:00:00", "subject": "SM"},
                    {"start": "11:00:00", "end": "13:00:00", "subject": "AS LAB-1/SM LAB-2"},
                    {"start": "13:40:00", "end": "14:40:00", "subject": "FM"},
                    {"start": "14:40:00", "end": "16:40:00", "subject": "H&W"}
                ],
                "Tuesday": [
                    {"start": "10:00:00", "end": "13:00:00", "subject": "TRAINING"},
                    {"start": "13:40:00", "end": "14:40:00", "subject": "P&S"},
                    {"start": "14:40:00", "end": "15:40:00", "subject": "CPDS"},
                    {"start": "15:40:00", "end": "16:40:00", "subject": "SM"}
                ],
                "Wednesday": [
                    {"start": "10:00:00", "end": "11:00:00", "subject": "CPDS"},
                    {"start": "11:00:00", "end": "13:00:00", "subject": "CPDS LAB"},
                    {"start": "13:40:00", "end": "14:40:00", "subject": "CT"},
                    {"start": "14:40:00", "end": "16:40:00", "subject": "SM LAB-1 /CT LAB-2"}
                ],
                "Thursday": [
                    {"start": "10:00:00", "end": "11:00:00", "subject": "SM"},
                    {"start": "11:00:00", "end": "12:00:00", "subject": "CT"},
                    {"start": "12:00:00", "end": "13:00:00", "subject": "FM"},
                    {"start": "13:40:00", "end": "14:40:00", "subject": "CPDS"},
                    {"start": "14:40:00", "end": "15:40:00", "subject": "P&S"},
                    {"start": "15:40:00", "end": "16:40:00", "subject": "CT"}
                ],
                "Friday": [
                    {"start": "10:00:00", "end": "11:00:00", "subject": "P&S"},
                    {"start": "11:00:00", "end": "13:00:00", "subject": "AS LAB-2/CT LAB-1"},
                    {"start": "13:40:00", "end": "14:40:00", "subject": "FM"},
                    {"start": "14:40:00", "end": "16:40:00", "subject": "CPDS LAB"}
                ],
                "Saturday": [
                    {"start": "10:00:00", "end": "11:00:00", "subject": "CT"},
                    {"start": "11:00:00", "end": "13:00:00", "subject": "CMT LAB"},
                    {"start": "13:40:00", "end": "14:40:00", "subject": "CPDS"},
                    {"start": "14:40:00", "end": "15:40:00", "subject": "SM"},
                    {"start": "15:40:00", "end": "16:40:00", "subject": "FM"}
                ]
            }
        }
    }
}

sql = []

for section, details in data["sections"].items():
    for day, slots in details["schedule"].items():
        for slot in slots:
            raw_sub = slot["subject"]
            
            # handle split labs
            subs = [s.strip() for s in raw_sub.replace('/', '|').split('|')]
            for s in subs:
                # remove batch tags like -1 or -2
                if s.endswith('-1'): s = s[:-2].strip()
                elif s.endswith('-2'): s = s[:-2].strip()
                
                course_info = details["courses"].get(s)
                if not course_info:
                    print(f"Warning: Course info not found for {s}")
                    continue
                
                # Check for NULL room logic (for resource_id). In original schema it was just room name as faculty_name if resource was null. But let's check existing DB entries. Usually we set resource_id to the room string if it exists in resources, but to avoid foreign key issues we can set resource_id = NULL and put it in faculty_name.
                # E.g. faculty_name = 'Room: D-102 | Dr. G. Gangadhar'
                fac = course_info["faculty"]
                room = course_info["room"]
                
                final_fac = f"Room: {room} | {fac}"
                
                q = f"""INSERT INTO timetable (department_id, academic_year, student_year, section, day_of_week, start_time, end_time, course_code, course_name, faculty_name, resource_id) VALUES ({data['department_id']}, '{data['academic_year']}', '{data['student_year']}', '{section}', '{day.upper()}', '{slot['start']}', '{slot['end']}', '{course_info['code']}', '{course_info['name']}', '{final_fac}', NULL);"""
                sql.append(q)

with open('civil_insert.sql', 'w') as f:
    f.write('\\n'.join(sql) + '\\n')
