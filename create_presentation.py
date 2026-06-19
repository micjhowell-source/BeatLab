from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

TEAL = RGBColor(0, 128, 128)
DARK_TEAL = RGBColor(0, 100, 100)
WHITE = RGBColor(255, 255, 255)
DARK_GRAY = RGBColor(60, 60, 60)
RED_ACCENT = RGBColor(200, 50, 50)
AMBER = RGBColor(220, 160, 30)
GREEN = RGBColor(40, 160, 80)
LIGHT_TEAL = RGBColor(220, 245, 245)
MID_GRAY = RGBColor(120, 120, 120)
PLACEHOLDER_BG = RGBColor(230, 230, 230)

def add_bg(slide, color):
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = color

def add_textbox(slide, left, top, width, height, text, font_size=18, bold=False, color=DARK_GRAY, align=PP_ALIGN.LEFT):
    txBox = slide.shapes.add_textbox(Inches(left), Inches(top), Inches(width), Inches(height))
    tf = txBox.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = text
    p.font.size = Pt(font_size)
    p.font.bold = bold
    p.font.color.rgb = color
    p.font.name = "Calibri"
    p.alignment = align
    return tf

def add_shape(slide, left, top, width, height, text, font_size=14, bg_color=TEAL, text_color=WHITE, bold=False, shape_type=MSO_SHAPE.ROUNDED_RECTANGLE):
    shape = slide.shapes.add_shape(shape_type, Inches(left), Inches(top), Inches(width), Inches(height))
    shape.fill.solid()
    shape.fill.fore_color.rgb = bg_color
    shape.line.fill.background()
    tf = shape.text_frame
    tf.word_wrap = True
    shape.text_frame.auto_size = None
    p = tf.paragraphs[0]
    p.text = text
    p.font.size = Pt(font_size)
    p.font.color.rgb = text_color
    p.font.bold = bold
    p.font.name = "Calibri"
    p.alignment = PP_ALIGN.CENTER
    return shape

def add_bullets(slide, left, top, width, height, lines, font_size=16, color=DARK_GRAY, bold_first=False):
    txBox = slide.shapes.add_textbox(Inches(left), Inches(top), Inches(width), Inches(height))
    tf = txBox.text_frame
    tf.word_wrap = True
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = "• " + line if line else ""
        p.font.size = Pt(font_size)
        p.font.color.rgb = color
        p.font.name = "Calibri"
        if bold_first and i == 0:
            p.font.bold = True
        p.space_after = Pt(font_size * 0.4)
    return tf

def add_image_placeholder(slide, left, top, width, height, label):
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(left), Inches(top), Inches(width), Inches(height))
    shape.fill.solid()
    shape.fill.fore_color.rgb = PLACEHOLDER_BG
    shape.line.color.rgb = MID_GRAY
    shape.line.width = Pt(2)
    tf = shape.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]
    p.text = label
    p.font.size = Pt(14)
    p.font.color.rgb = MID_GRAY
    p.font.name = "Calibri"
    p.font.bold = True
    p.alignment = PP_ALIGN.CENTER
    p2 = tf.add_paragraph()
    p2.text = "Right-click → Change Picture"
    p2.font.size = Pt(11)
    p2.font.color.rgb = MID_GRAY
    p2.font.name = "Calibri"
    p2.alignment = PP_ALIGN.CENTER
    return shape


# ==================== SLIDE 1: TITLE ====================
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide, TEAL)
add_textbox(slide, 1, 1.5, 11, 1.5, "Rethinking Wound Cleansing", 44, True, WHITE, PP_ALIGN.CENTER)
add_textbox(slide, 1, 3.0, 11, 1, "Evidence-Based Practice Improvement Initiative", 24, False, RGBColor(200, 240, 240), PP_ALIGN.CENTER)
add_textbox(slide, 1, 4.5, 11, 0.6, "Megan Howell RN", 20, False, WHITE, PP_ALIGN.CENTER)
add_textbox(slide, 1, 5.2, 11, 0.6, "Based on the IWII/Wounds International Consensus Document 2025", 16, False, RGBColor(180, 220, 220), PP_ALIGN.CENTER)
add_textbox(slide, 1, 5.8, 11, 0.6, "Therapeutic Wound & Skin Cleansing: Clinical Evidence and Recommendations", 14, False, RGBColor(180, 220, 220), PP_ALIGN.CENTER)


# ==================== SLIDE 2: WHY THIS MATTERS ====================
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide, WHITE)
add_shape(slide, 0, 0, 13.333, 1.0, "Why Does This Matter?", 28, TEAL, WHITE, True)

add_bullets(slide, 0.8, 1.4, 5.5, 5.5, [
    "What are we currently doing?",
    "Chlorhexidine 0.05% + Cetrimide 5% used to cleanse wounds routinely after dressing removal",
    "Applied to all wound types regardless of infection status",
    "This is a common practice — but is it best practice?",
], 17, DARK_GRAY, True)

add_shape(slide, 7.0, 1.5, 5.5, 2.2,
    "Key Question\n\nAre we helping or hindering\nwound healing with routine\nantiseptic cleansing?", 18, RGBColor(240, 240, 250), DARK_TEAL, True)

add_shape(slide, 7.0, 4.0, 5.5, 2.8,
    "The 2025 IWII Consensus\n\n> Systematic literature review\n> Delphi consensus process\n> 13 clinical recommendations\n> International expert panel\n> Strongest wound cleansing\n   guidance to date", 16, LIGHT_TEAL, DARK_TEAL, False)


# ==================== SLIDE 3: WOUND PHOTOS — WHAT ARE WE CLEANSING? ====================
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide, WHITE)
add_shape(slide, 0, 0, 13.333, 1.0, "What Are We Cleansing? — Know Your Wound Status", 28, TEAL, WHITE, True)

# Three image placeholders with labels
add_shape(slide, 0.5, 1.3, 3.8, 0.6, "Clean / Healing Wound", 16, GREEN, WHITE, True)
add_image_placeholder(slide, 0.5, 2.1, 3.8, 3.0, "INSERT PHOTO\n\nClean granulating wound\nor healing skin tear")
add_bullets(slide, 0.5, 5.3, 3.8, 1.8, [
    "Healthy granulation tissue",
    "No signs of infection",
    "Cleanse with SALINE only",
], 13, GREEN)

add_shape(slide, 4.7, 1.3, 3.8, 0.6, "Biofilm / At Risk", 16, AMBER, WHITE, True)
add_image_placeholder(slide, 4.7, 2.1, 3.8, 3.0, "INSERT PHOTO\n\nWound with suspected biofilm\nor stalled healing")
add_bullets(slide, 4.7, 5.3, 3.8, 1.8, [
    "Slimy / shiny wound bed",
    "Stalled healing despite treatment",
    "Consider antimicrobial cleanser",
], 13, AMBER)

add_shape(slide, 8.9, 1.3, 3.8, 0.6, "Infected Wound", 16, RED_ACCENT, WHITE, True)
add_image_placeholder(slide, 8.9, 2.1, 3.8, 3.0, "INSERT PHOTO\n\nClinically infected wound\n(spreading erythema, purulence)")
add_bullets(slide, 8.9, 5.3, 3.8, 1.8, [
    "Classic infection signs (NERDS/STONEES)",
    "Systemic + local treatment",
    "Targeted short-term antiseptic",
], 13, RED_ACCENT)


# ==================== SLIDE 4: WHAT IS BIOFILM? ====================
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide, WHITE)
add_shape(slide, 0, 0, 13.333, 1.0, "What Is Biofilm? — A Quick Primer", 28, AMBER, WHITE, True)

add_bullets(slide, 0.5, 1.3, 5.8, 2.5, [
    "A biofilm is a community of bacteria that stick together and coat themselves in a protective slime layer (matrix)",
    "This matrix shields bacteria from antibiotics, antiseptics, and the body's immune response",
    "Present in up to 78% of chronic wounds",
    "Often invisible to the naked eye — but can appear as a slimy, shiny coating on the wound bed",
], 16, DARK_GRAY)

add_image_placeholder(slide, 7.0, 1.3, 5.5, 2.5, "INSERT PHOTO\n\nBiofilm on a wound bed\n(slimy/shiny appearance)")

# Why it matters box
add_shape(slide, 0.5, 4.0, 5.8, 3.0,
    "Why Does Biofilm Matter?\n\n> Delays wound healing significantly\n> Reforms within 24 hours of disruption\n> Cannot be removed by rinsing alone\n> Requires active mechanical disruption\n   + antimicrobial cleansing\n> CHX is NOT the right tool — modern\n   antiseptics (PHMB, HOCl) are more\n   effective with less tissue damage", 14, LIGHT_TEAL, DARK_TEAL, False)

# Clinical clues box
add_shape(slide, 7.0, 4.0, 5.5, 3.0,
    "Clinical Clues — Suspect Biofilm When:\n\n> Wound has stalled despite appropriate care\n> Slimy or shiny wound bed surface\n> Friable granulation tissue\n> Recurring local infection\n> Wound responds to antimicrobials\n   but relapses when stopped\n> Failed to progress in 2–4 weeks", 14, RGBColor(255, 248, 230), DARK_GRAY, False)


# ==================== SLIDE 5: THE PROBLEM WITH CHLORHEX ====================
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide, WHITE)
add_shape(slide, 0, 0, 13.333, 1.0, "The Problem: Chlorhexidine + Cetrimide on Wounds", 28, RED_ACCENT, WHITE, True)

add_shape(slide, 0.5, 1.3, 3.8, 0.6, "Cytotoxicity Evidence", 18, DARK_TEAL, WHITE, True)
add_bullets(slide, 0.5, 2.1, 3.8, 4.5, [
    "Fibroblasts exposed to 0.05% CHX for 15 mins — non-viable within 24 hours",
    "Even at 0.002% CHX suppresses cell division almost completely",
    "Cetrimide adds further cytotoxic burden — disrupts cell membranes",
    "Dose- and time-dependent damage to the very cells that heal wounds",
], 14, DARK_GRAY)

add_shape(slide, 4.7, 1.3, 3.8, 0.6, "What Gets Damaged?", 18, RED_ACCENT, WHITE, True)
add_bullets(slide, 4.7, 2.1, 3.8, 4.5, [
    "Fibroblasts — produce collagen and extracellular matrix for wound repair",
    "Keratinocytes — drive re-epithelialisation and wound closure",
    "Growth factors — disrupted signalling cascades",
    "Granulation tissue — the foundation of healing",
], 14, DARK_GRAY)

add_shape(slide, 8.9, 1.3, 3.8, 0.6, "Clinical Impact", 18, AMBER, WHITE, True)
add_bullets(slide, 8.9, 2.1, 3.8, 4.5, [
    "Delayed wound healing — more visits, more costs, more patient burden",
    "No evidence of benefit for routine use on non-infected wounds",
    "CHX group showed more days to healing vs saline in comparative studies",
    "We may be undoing our good wound management with every dressing change",
], 14, DARK_GRAY)

add_shape(slide, 1.5, 5.8, 10, 1.2,
    "\"Antiseptics should not be used routinely on wounds that are healing normally\"\n— Consistent finding across wound care literature",
    16, RGBColor(255, 240, 240), RED_ACCENT, False)


# ==================== SLIDE 6: WHAT SHOULD WE USE ====================
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide, WHITE)
add_shape(slide, 0, 0, 13.333, 1.0, "What Should We Use? — IWII 2025 Guidance", 28, TEAL, WHITE, True)

add_shape(slide, 0.5, 1.3, 3.8, 0.7, "Clean / Healing Wounds", 16, GREEN, WHITE, True)
add_bullets(slide, 0.5, 2.2, 3.8, 3.5, [
    "Normal saline (0.9% NaCl)",
    "Potable/tap water",
    "Sterile water",
    "",
    "Non-cytotoxic, non-allergenic",
    "Supports the healing environment",
    "Maintains optimal wound pH (4-5.5)",
    "This covers MOST of our wounds",
], 14, DARK_GRAY)

add_shape(slide, 4.7, 1.3, 3.8, 0.7, "Infection Risk / Biofilm", 16, AMBER, WHITE, True)
add_bullets(slide, 4.7, 2.2, 3.8, 3.5, [
    "PHMB (polyhexanide)",
    "Hypochlorous acid (HOCl)",
    "Octenidine",
    "",
    "Modern antiseptics — safe + effective",
    "Targeted biofilm disruption",
    "Lower cytotoxicity than CHX",
    "Use purposefully, not prophylactically",
], 14, DARK_GRAY)

add_shape(slide, 8.9, 1.3, 3.8, 0.7, "Avoid for Routine Use", 16, RED_ACCENT, WHITE, True)
add_bullets(slide, 8.9, 2.2, 3.8, 3.5, [
    "Chlorhexidine",
    "Cetrimide",
    "Hydrogen peroxide",
    "",
    "Cytotoxic to healing cells",
    "No evidence of benefit in clean wounds",
    "Disrupts wound pH",
    "Damages granulation tissue",
], 14, DARK_GRAY)

add_shape(slide, 1.5, 5.8, 10, 1.2,
    "IWII 2025: \"Solution selection should align with the wound's infection status\"\nClean wounds = inert solutions  |  Infection/biofilm = targeted modern antiseptics",
    16, LIGHT_TEAL, DARK_TEAL, True)


# ==================== SLIDE 7: DECISION FRAMEWORK — STEPS ====================
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide, WHITE)
add_shape(slide, 0, 0, 13.333, 1.0, "Wound Cleansing Decision Framework — The Process", 28, TEAL, WHITE, True)
add_textbox(slide, 0.5, 1.1, 12, 0.5, "Adapted from the IWII 2025 Wound Cleansing Continuum (p.32)", 14, False, MID_GRAY, PP_ALIGN.LEFT)

# Four steps - bigger, clearer
add_shape(slide, 0.5, 1.8, 2.8, 4.5, "1. ASSESS\n\n\nExamine:\n> Wound bed\n> Wound edges\n> Periwound skin\n> Surrounding skin\n\nWhat do you see?\nWhat has changed\nsince last visit?", 15, TEAL, WHITE, True)

add_shape(slide, 3.6, 3.5, 0.5, 0.5, "=>", 18, WHITE, TEAL, True, MSO_SHAPE.OVAL)

add_shape(slide, 4.3, 1.8, 2.8, 4.5, "2. DECIDE\n\n\nDetermine wound\ninfection status:\n\n> Bacterial balance?\n> Local infection?\n> Spreading infection?\n> Biofilm suspected?\n\nThis drives your\nsolution choice", 15, AMBER, WHITE, True)

add_shape(slide, 7.3, 3.5, 0.5, 0.5, "=>", 18, WHITE, TEAL, True, MSO_SHAPE.OVAL)

add_shape(slide, 8.0, 1.8, 2.5, 4.5, "3. SELECT\n\n\nChoose:\n> Solution\n> Technique\n> Irrigation pressure\n> Frequency\n\nMatch solution\nto wound status\n(see next slide)", 15, GREEN, WHITE, True)

add_shape(slide, 10.7, 3.5, 0.5, 0.5, "=>", 18, WHITE, TEAL, True, MSO_SHAPE.OVAL)

add_shape(slide, 11.4, 1.8, 1.5, 4.5, "4.\nEVALUATE\n\n\nIs the\nwound\nimproving?\n\nIf not,\nreassess\nand\nadjust", 14, DARK_TEAL, WHITE, True)

add_shape(slide, 1.5, 6.6, 10, 0.7,
    "Key principle: ASSESS before you pour — the wound status determines the solution, not habit",
    16, LIGHT_TEAL, DARK_TEAL, True)


# ==================== SLIDE 8: DECISION FRAMEWORK — PATHWAYS ====================
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide, WHITE)
add_shape(slide, 0, 0, 13.333, 1.0, "Wound Cleansing Pathways — Matching Solution to Status", 28, TEAL, WHITE, True)
add_textbox(slide, 0.5, 1.1, 12, 0.5, "Adapted from the IWII 2025 Wound Cleansing Continuum (p.32)", 14, False, MID_GRAY, PP_ALIGN.LEFT)

# Three pathways - bigger and clearer
add_shape(slide, 0.3, 1.8, 4.0, 5.0,
    "BACTERIAL BALANCE\n(Most of our wounds)\n\n"
    "Solution:\n> Normal saline (0.9% NaCl)\n> Potable / tap water\n\n"
    "Technique:\n> Gentle irrigation\n> Cleanse wound bed, edges\n   and periwound skin\n\n"
    "Frequency:\n> Each dressing change\n> Reassess at every visit",
    14, RGBColor(230, 250, 240), DARK_TEAL, False)

add_shape(slide, 4.6, 1.8, 4.0, 5.0,
    "BIOFILM / AT RISK\n\n\n"
    "Solution:\n> PHMB (polyhexanide)\n> Hypochlorous acid (HOCl)\n> Octenidine\n\n"
    "Technique:\n> Active mechanical cleansing\n> Wound bed preparation\n> Debridement if indicated\n\n"
    "Key: Treat the cause,\nnot routine prophylaxis",
    14, RGBColor(255, 248, 230), DARK_GRAY, False)

add_shape(slide, 8.9, 1.8, 4.0, 5.0,
    "INFECTED WOUND\n\n\n"
    "Solution:\n> Antimicrobial cleanser\n> + systemic Abx as needed\n\n"
    "Technique:\n> Discuss with GP\n> Swab if clinically indicated\n> Targeted short-term antiseptic\n\n"
    "Key: Step DOWN to saline\nwhen infection resolves.\nDon't continue antiseptic\nindefinitely",
    14, RGBColor(255, 235, 235), RED_ACCENT, False)


# ==================== SLIDE 9: WHAT I'M PROPOSING ====================
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide, WHITE)
add_shape(slide, 0, 0, 13.333, 1.0, "What I'm Proposing We Consider", 28, TEAL, WHITE, True)

add_bullets(slide, 0.8, 1.3, 5.5, 5.5, [
    "Immediate — Wound Cleansing",
    "",
    "Switch routine wound cleansing to normal saline or potable water for non-infected wounds",
    "Reserve antiseptics (PHMB, HOCl) for wounds with suspected infection or biofilm",
    "Stop routine chlorhexidine + cetrimide use on healing wounds",
    "Adopt a cleansing decision framework based on wound status (adapted from IWII 2025)",
], 16, DARK_GRAY, True)

add_bullets(slide, 7.0, 1.3, 5.5, 5.5, [
    "Bigger Picture — Where This Fits",
    "",
    "This is step 1 of updating our wound care approach",
    "Future: wound assessment, documentation, product selection, evidence-based dressings",
    "Potential for nurse-led wound clinics",
    "Aligns with Medicare wound management items and best-practice care",
    "I'd love a GP champion to partner on wound care practice updates",
], 16, DARK_GRAY, True)

add_shape(slide, 2.0, 5.8, 9, 1.2,
    "This isn't about criticism — it's about giving our patients the best chance to heal.\nSmall change, big evidence, better outcomes.",
    18, LIGHT_TEAL, DARK_TEAL, True)


# ==================== SLIDE 10: DISCUSSION ====================
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide, TEAL)
add_textbox(slide, 1, 1.5, 11, 1.2, "Discussion & Questions", 40, True, WHITE, PP_ALIGN.CENTER)
add_textbox(slide, 1, 3.0, 11, 0.8, "What are your thoughts?", 24, False, RGBColor(200, 240, 240), PP_ALIGN.CENTER)

add_bullets(slide, 2.5, 4.0, 8, 2.5, [
    "Would anyone be interested in championing this with me?",
    "Can we trial saline-first cleansing for 4 weeks?",
    "Would a wound cleansing quick-reference card be useful?",
], 20, RGBColor(200, 240, 240))

add_textbox(slide, 1, 6.2, 11, 0.8,
    "Reference: IWII (2025) Therapeutic Wound & Skin Cleansing:\nClinical Evidence and Recommendations. Wounds International.", 14, False, RGBColor(160, 200, 200), PP_ALIGN.CENTER)


# Save
output_path = "/home/user/BeatLab/Wound_Cleansing_Presentation.pptx"
prs.save(output_path)
print(f"Saved to {output_path}")
