import frappe
import json
import re
from datetime import date
from openai import OpenAI

client = OpenAI(api_key=frappe.conf.get("openai_api_key"))

# ======================================================
# MAIN ROUTER
# ======================================================
@frappe.whitelist()
def ai_router(message):
    if not message:
        return "❌ Empty message"

    text = message.strip()
    text_l = text.lower()

    # ==================================================
    # 🧠 ANY DOCTYPE RECORD CREATE (TOP PRIORITY)
    # ==================================================
    if text_l.startswith("create "):
        return create_any_doctype_record(text)

    # ---------- OPEN DOCTYPE ----------
    if text_l.startswith("open "):
        doctype = text.replace("open", "", 1).strip().title()
        if frappe.db.exists("DocType", doctype):
            return {"action": "open", "doctype": doctype}
        return f"❌ Doctype not found: {doctype}"

    # ---------- DASHBOARD ----------
    if text_l == "dashboard":
        return {
            "action": "dashboard",
            "data": {
                "customers": frappe.db.count("Customer"),
                "employees": frappe.db.count("Employee"),
                "items": frappe.db.count("Item"),
                "sales": frappe.db.count("Sales Invoice", {"docstatus": 1}),
                "purchase": frappe.db.count("Purchase Invoice", {"docstatus": 1})
            }
        }

    # ---------- ATTENDANCE DASHBOARD ----------
    if text_l == "attendance dashboard":
        return {
            "action": "attendance_dashboard",
            "data": {
                "labels": ["Present", "Absent"],
                "values": [
                    frappe.db.count("Attendance", {"status": "Present"}),
                    frappe.db.count("Attendance", {"status": "Absent"})
                ]
            }
        }

    # ---------- SALES DASHBOARD ----------
    if text_l == "sales dashboard":
        rows = frappe.db.sql("""
            SELECT MONTH(posting_date), COUNT(name)
            FROM `tabSales Invoice`
            WHERE docstatus = 1
            GROUP BY MONTH(posting_date)
        """)
        return {
            "action": "sales_dashboard",
            "data": {
                "labels": [f"Month {r[0]}" for r in rows],
                "values": [r[1] for r in rows]
            }
        }

    # ---------- DOCTYPE CREATE (AI) ----------
    if text_l.startswith("doctype"):
        return create_doctype_with_ai(text)

    # ---------- NORMAL AI ----------
    res = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": message}],
        temperature=0
    )
    return res.choices[0].message.content


# ======================================================
# 🧠 ANY DOCTYPE RECORD CREATOR (CHAT NAME FIXED)
# ======================================================
def create_any_doctype_record(message):
    parts = message.split()
    doctype = parts[1].title()

    if not frappe.db.exists("DocType", doctype):
        return f"❌ Doctype {doctype} not found"

    meta = frappe.get_meta(doctype)
    values = extract_key_values(message)

    doc_data = {"doctype": doctype}

    # 👉 CHAT SE NAME NIKALO
    chat_name = (
        values.get("name")
        or values.get("customer_name")
        or values.get("item_name")
        or values.get("employee_name")
        or values.get("first_name")
        or values.get("model")
        or doctype
    )

    for df in meta.fields:
        fname = df.fieldname

        if fname in values:
            doc_data[fname] = cast_value(values[fname], df.fieldtype)

        elif df.reqd:
            doc_data[fname] = auto_fill_required(df, chat_name)

    # 👉 DOC NAME FIX
    if meta.autoname in ("", "prompt") or meta.autoname.startswith("field:"):
        doc_data["name"] = chat_name

    try:
        doc = frappe.get_doc(doc_data)
        doc.insert(ignore_permissions=True)
        frappe.db.commit()
        return f"✅ {doctype} record created successfully"
    except Exception as e:
        return f"❌ Create failed: {str(e)}"


# ======================================================
# 🤖 AI DOCTYPE CREATOR
# ======================================================
def create_doctype_with_ai(message):
    prompt = f"""
Return STRICT JSON only.

Instruction:
{message}

Format:
{{
  "doctype": "Vehicle",
  "module": "Custom",
  "fields": [
    {{"label":"Model","fieldname":"model","fieldtype":"Data"}},
    {{"label":"Price","fieldname":"price","fieldtype":"Currency"}}
  ]
}}
"""

    res = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0
    )

    raw = res.choices[0].message.content or ""
    match = re.search(r"\{.*\}", raw, re.S)
    if not match:
        return "❌ AI JSON error"

    data = json.loads(match.group())

    if frappe.db.exists("DocType", data["doctype"]):
        return f"❌ Doctype {data['doctype']} already exists"

    doc = frappe.get_doc({
        "doctype": "DocType",
        "name": data["doctype"],
        "module": data.get("module", "Custom"),
        "custom": 1,
        "fields": data["fields"],
        "permissions": [{
            "role": "System Manager",
            "read": 1,
            "write": 1,
            "create": 1,
            "delete": 1
        }]
    })

    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return f"✅ Doctype {data['doctype']} created"


# ======================================================
# 🔧 AUTO FILL REQUIRED (AUTO ❌ → CHAT NAME ✅)
# ======================================================
def auto_fill_required(df, chat_name):
    if df.fieldtype == "Data":
        return chat_name
    if df.fieldtype == "Int":
        return 0
    if df.fieldtype in ("Float", "Currency"):
        return 0.0
    if df.fieldtype == "Date":
        return date.today()
    if df.fieldtype == "Select":
        return df.options.split("\n")[0] if df.options else None
    if df.fieldtype == "Link":
        return frappe.db.get_value(df.options, {}, "name")
    return None


# ======================================================
# 🔧 HELPERS
# ======================================================
def extract_key_values(text):
    parts = text.split()
    data = {}
    i = 2
    while i < len(parts) - 1:
        data[parts[i].lower()] = parts[i + 1]
        i += 2
    return data


def cast_value(value, fieldtype):
    if fieldtype in ("Int", "Check"):
        return int(value)
    if fieldtype in ("Float", "Currency"):
        return float(value)
    return value
