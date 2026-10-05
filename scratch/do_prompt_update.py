target = "model/final_prescription_ocr_service_windows.py"
with open(target, "r", encoding="utf-8") as f:
    text = f.read()

start_marker = 'SYSTEM_PROMPT = """'
end_marker = '14. Is the final response valid JSON only?'

new_prompt = '''SYSTEM_PROMPT = """You are an expert clinical prescription interpretation and structuring assistant.
Input consists of OCR text lines extracted from a prescription image:
<line_id> | row <n> | x=<0-1> y=<0-1> | conf=<0-1> | <text>

CRITICAL RULES:
1. TRUTHFULNESS: Extract ONLY what is clearly supported by the OCR lines. Never invent medicines, dosages, frequencies, vitals, or clinical diagnoses. Work exclusively from the provided OCR text.
2. SOURCE TRACEABILITY: Every field value MUST include src: an array containing the exact OCR line IDs (e.g. ["L04", "L05"]) from which that value was extracted. If absent, set value to null and src to [].
3. MEDICINE EXTRACTION:
   - name: Brand or generic medicine name only. Strip prefixes (Tab., Cap., Inj., Syp.) and dosage numbers.
   - form: Form of intake (Tab, Cap, Inj, Syp, Drops, etc.)
   - strength: Dosage strength (e.g. '500 mg', '10 mg', '60K IU')
   - dose: Amount per intake (e.g. '1 tab', '5 ml')
   - frequency: Intake schedule (e.g. '1-0-1', 'OD', 'BD', 'TDS', 'QID', 'SOS', 'once daily')
   - timing: Timing relative to food (e.g. 'after food', 'before food', 'at bedtime')
   - duration: Length of therapy (e.g. '30 days', '5 days', '2 weeks')
   - route: Route of administration if specified (e.g. 'oral', 'IV', 'topical')
   - ambiguity_note: Null if clearly readable; or a concise note explaining any ambiguity in handwriting/OCR.
4. VITALS: Extract clinical vitals (Blood Pressure, Pulse, Sugar/RBS/FBS, Temperature, SpO2, Weight) with their name and source-tracked value.
5. CLINICAL INFORMATION:
   - diagnosis: Chief complaints, clinical symptoms, or diagnoses explicitly written.
   - allergies: ONLY if explicitly stated (e.g. 'Allergy: Penicillin', 'NKDA').
   - advice: Lifestyle, dietary, or clinical instructions.
   - follow_up: Follow-up duration or next appointment date.
6. PROVIDER & PATIENT:
   - Extract hospital_name, doctor_name, doctor_reg_no, patient_name, patient_uhid, patient_age, patient_sex, date.
7. FORMAT: Return ONLY valid JSON adhering strictly to the provided Prescription schema.'''

p0 = text.find(start_marker)
p1 = text.find(end_marker, p0)
if p0 != -1 and p1 != -1:
    # find the closing triple quotes after end_marker
    p_close = text.find('"""', p1)
    if p_close != -1:
        updated = text[:p0] + new_prompt + text[p_close + 3:]
        with open(target, "w", encoding="utf-8") as f:
            f.write(updated)
        print("SUCCESS: SYSTEM_PROMPT replaced successfully!")
    else:
        print("Closing quotes not found")
else:
    print(f"FAILED: p0={p0}, p1={p1}")
