from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
import os

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

# Colors
TEAL = RGBColor(0, 128, 128)
DARK_TEAL = RGBColor(0, 100, 100)
WHITE = RGBColor(255, 255, 255)
LIGHT_GRAY = RGBColor(240, 240, 240)
DARK_GRAY = RGBColor(60, 60, 60)
RED_ACCENT = RGBColor(200, 50, 50)
AMBER = RGBColor(220, 160, 30)
GREEN = RGBColor(40, 160, 80)
LIGHT_TEAL = RGBColor(220, 245, 245)

def add_bg(slide, color):
    bg = slide.background
    fill = bg.fill
    fill.solid()
    fill.fore_color.rgb = color

def add_textbox(slide, left, top, width, height, text, font_size=18, bold=False, color=DARK_GRAY, align=PP_ALIGN.LEFT, font_name="Calibri"):
    txBox = slide.shapes.add_textbox(Inches(left), Inches(top), Inches(width), Inches(height))
    tf = txBox.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = text
    p.font.size = Pt(font_size)
    p.font.bold = bold
    p.font.color.rgb = color
    p.font.name = font_name
    p.alignment = align
    return tf

def add_shape_with_text(slide, left, top, width, height, text, font_size=14, bg_color=TEAL, text_color=WHITE, bold=False, shape_type=MSO_SHAPE.ROUNDED_RECTANGLE):
    shape = slide.shapes.add_shape(shape_type, Inches(left), Inches(top), Inches(width), Inches(height))
    shape.fill.solid()
    shape.fill.fore_color.rgb = bg_color
    shape.line.fill.background()
    tf = shape.text_frame
    tf.word_wrap = True
    tf.paragraphs[0].alignment = PP_ALIGN.CENTER
    p = tf.paragraphs[0]
    p.text = text
    p.font.size = Pt(font_size)
    p.font.color.rgb = text_color
    p.font.bold = bold
    p.font.name = "Calibri"
    tf.paragraphs[0].space_before = Pt(0)
    tf.paragraphs[0].space_after = Pt(0)
    from pptx.enum.text import MSO_ANCHOR
    tf.word_wrap = True
    shape.text_frame.auto_size = None
    return shape

def add_multi_text(slide, left, top, width, height, lines, font_size=16, color=DARK_GRAY, bold_first=False, bullet=False, line_spacing=1.5):
    txBox = slide.shapes.add_textbox(Inches(left), Inches(top), Inches(width), Inches(height))
    tf = txBox.text_frame
    tf.word_wrap = True
    for i, line in enumerate(lines):
        if i == 0:
            p = tf.paragraphs[0]
        else:
            p = tf.add_paragraph()
        prefix = "• " if bullet else ""
        p.text = prefix + line
        p.font.size = Pt(font_size)
        p.font.color.rgb = color
        p.font.name = "Calibri"
        if bold_first and i == 0:
            p.font.bold = True
        p.space_after = Pt(font_size * 0.4)
    return tf

# ==================== SLIDE 1: TITLE ====================
slide = prs.slides.add_slide(prs.slide_layouts[6])  # blank
add_bg(slide, TEAL)

add_textbox(slide, 1, 1.5, 11, 1.5, "Rethinking Wound Cleansing", 44, True, WHITE, PP_ALIGN.CENTER)
add_textbox(slide, 1, 3.0, 11, 1, "Evidence-Based Practice Improvement Initiative", 24, False, RGBColor(200, 240, 240), PP_ALIGN.CENTER)
add_textbox(slide, 1, 4.5, 11, 0.6, "Megan Howell RN", 20, False, WHITE, PP_ALIGN.CENTER)
add_textbox(slide, 1, 5.2, 11, 0.6, "Based on the IWII/Wounds International Consensus Document 2025", 16, False, RGBColor(180, 220, 220), PP_ALIGN.CENTER)
add_textbox(slide, 1, 5.8, 11, 0.6, "Therapeutic Wound & Skin Cleansing: Clinical Evidence and Recommendations", 14, False, RGBColor(180, 220, 220), PP_ALIGN.CENTER)

# ==================== SLIDE 2: WHY THIS MATTERS ====================
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide, WHITE)
add_shape_with_text(slide, 0, 0, 13.333, 1.0, "Why Does This Matter?", 28, TEAL, WHITE, True)

add_multi_text(slide, 0.8, 1.4, 5.5, 5.5, [
    "What are we currently doing?",
    "Chlorhexidine 0.05% + Cetrimide 5% used to cleanse wounds routinely after dressing removal",
    "Applied to all wound types regardless of infection status",
    "This is a common practice — but is it best practice?",
], 17, DARK_GRAY, True, True)

add_shape_with_text(slide, 7.0, 1.5, 5.5, 2.2,
    "🤔 Key Question\n\nAre we helping or hindering\nwound healing with routine\nantiseptic cleansing?", 18, RGBColor(240, 240, 250), DARK_TEAL, True)

add_shape_with_text(slide, 7.0, 4.0, 5.5, 2.8,
    "The 2025 IWII Consensus\n\n✓ Systematic literature review\n✓ Delphi consensus process\n✓ 13 clinical recommendations\n✓ International expert panel\n✓ Strongest wound cleansing\n   guidance to date", 16, LIGHT_TEAL, DARK_TEAL, False)

# ==================== SLIDE 3: THE PROBLEM WITH CHLORHEX ====================
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide, WHITE)
add_shape_with_text(slide, 0, 0, 13.333, 1.0, "The Problem: Chlorhexidine + Cetrimide on Wounds", 28, RED_ACCENT, WHITE, True)

# Left column - cytotoxicity
add_shape_with_text(slide, 0.5, 1.3, 3.8, 0.6, "Cytotoxicity Evidence", 18, DARK_TEAL, WHITE, True)
add_multi_text(slide, 0.5, 2.1, 3.8, 4.5, [
    "Fibroblasts exposed to 0.05% CHX for 15 mins → non-viable within 24 hours",
    "Even at 0.002% CHX suppresses cell division almost completely",
    "Cetrimide adds further cytotoxic burden — a surfactant that disrupts cell membranes",
    "Dose- and time-dependent damage to the very cells that heal wounds",
], 14, DARK_GRAY, False, True)

# Middle column - what it kills
add_shape_with_text(slide, 4.7, 1.3, 3.8, 0.6, "What Gets Damaged?", 18, RED_ACCENT, WHITE, True)
add_multi_text(slide, 4.7, 2.1, 3.8, 4.5, [
    "Fibroblasts — produce collagen and extracellular matrix for wound repair",
    "Keratinocytes — drive re-epithelialisation and wound closure",
    "Growth factors — disrupted signalling cascades",
    "Granulation tissue — the foundation of healing",
], 14, DARK_GRAY, False, True)

# Right column - clinical impact
add_shape_with_text(slide, 8.9, 1.3, 3.8, 0.6, "Clinical Impact", 18, AMBER, WHITE, True)
add_multi_text(slide, 8.9, 2.1, 3.8, 4.5, [
    "Delayed wound healing — more visits, more costs, more patient burden",
    "No evidence of benefit for routine use on non-infected wounds",
    "CHX group showed more days to healing vs saline in comparative studies",
    "We may be undoing our good wound management with every dressing change",
], 14, DARK_GRAY, False, True)

# Bottom callout
add_shape_with_text(slide, 1.5, 5.8, 10, 1.2,
    "\"Antiseptics should not be used routinely on wounds that are healing normally\"\n— Consistent finding across wound care literature",
    16, RGBColor(255, 240, 240), RED_ACCENT, False)

# ==================== SLIDE 4: WHAT THE EVIDENCE SAYS ====================
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide, WHITE)
add_shape_with_text(slide, 0, 0, 13.333, 1.0, "What Should We Use? — IWII 2025 Guidance", 28, TEAL, WHITE, True)

# Traffic light system
# GREEN - clean wounds
add_shape_with_text(slide, 0.5, 1.3, 3.8, 0.7, "✅  Clean / Healing Wounds", 16, GREEN, WHITE, True)
add_multi_text(slide, 0.5, 2.2, 3.8, 3.5, [
    "Normal saline (0.9% NaCl)",
    "Potable/tap water",
    "Sterile water",
    "",
    "Non-cytotoxic, non-allergenic",
    "Supports the healing environment",
    "Maintains optimal wound pH (4–5.5)",
    "This covers MOST of our wounds",
], 14, DARK_GRAY, False, True)

# AMBER - at risk / biofilm
add_shape_with_text(slide, 4.7, 1.3, 3.8, 0.7, "⚠️  Infection Risk / Biofilm", 16, AMBER, WHITE, True)
add_multi_text(slide, 4.7, 2.2, 3.8, 3.5, [
    "PHMB (polyhexanide)",
    "Hypochlorous acid (HOCl)",
    "Octenidine",
    "",
    "Modern antiseptics with evidence for safety + efficacy",
    "Targeted biofilm disruption",
    "Lower cytotoxicity than CHX",
    "Use purposefully, not prophylactically",
], 14, DARK_GRAY, False, True)

# RED - what to avoid
add_shape_with_text(slide, 8.9, 1.3, 3.8, 0.7, "🛑  Avoid for Routine Use", 16, RED_ACCENT, WHITE, True)
add_multi_text(slide, 8.9, 2.2, 3.8, 3.5, [
    "Chlorhexidine",
    "Cetrimide",
    "Hydrogen peroxide",
    "",
    "Cytotoxic to healing cells",
    "No evidence of benefit in clean wounds",
    "Disrupts wound pH",
    "Damages granulation tissue",
], 14, DARK_GRAY, False, True)

# Bottom key message
add_shape_with_text(slide, 1.5, 5.8, 10, 1.2,
    "IWII 2025: \"Solution selection should align with the wound's infection status\"\nClean wounds → inert solutions  |  Infection/biofilm → targeted modern antiseptics",
    16, LIGHT_TEAL, DARK_TEAL, True)

# ==================== SLIDE 5: WOUND CLEANSING DECISION FRAMEWORK ====================
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide, WHITE)
add_shape_with_text(slide, 0, 0, 13.333, 1.0, "Proposed Wound Cleansing Decision Framework", 28, TEAL, WHITE, True)
add_textbox(slide, 0.5, 1.1, 12, 0.5, "Adapted from the IWII 2025 Wound Cleansing Continuum (p.32)", 14, False, RGBColor(120,120,120), PP_ALIGN.LEFT)

# Step 1 - Assess
add_shape_with_text(slide, 0.5, 1.8, 2.8, 1.5, "1. ASSESS\n\nWound bed\nWound edges\nPeriwound skin\nSigns of infection?", 13, TEAL, WHITE, True)

# Arrow
add_shape_with_text(slide, 3.5, 2.2, 0.6, 0.6, "→", 24, WHITE, TEAL, True, MSO_SHAPE.OVAL)

# Step 2 - Decide
add_shape_with_text(slide, 4.3, 1.8, 2.8, 1.5, "2. DECIDE\n\nBacterial balance?\nBiofilm suspected?\nCritically colonised?\nInfected?", 13, AMBER, WHITE, True)

# Arrow
add_shape_with_text(slide, 7.3, 2.2, 0.6, 0.6, "→", 24, WHITE, TEAL, True, MSO_SHAPE.OVAL)

# Step 3 - Select
add_shape_with_text(slide, 8.1, 1.8, 2.8, 1.5, "3. SELECT\n\nSolution\nTechnique\nPressure\nFrequency", 13, GREEN, WHITE, True)

# Arrow
add_shape_with_text(slide, 11.1, 2.2, 0.6, 0.6, "→", 24, WHITE, TEAL, True, MSO_SHAPE.OVAL)

# Step 4 - Evaluate
add_shape_with_text(slide, 11.9, 1.8, 1.2, 1.5, "4.\nEVALUATE\n\nIs it\nworking?", 12, DARK_TEAL, WHITE, True)

# Decision paths below
add_shape_with_text(slide, 0.5, 3.8, 4.0, 2.8,
    "Bacterial Balance\n(Most of our wounds)\n\n→ Normal saline or potable water\n→ Gentle irrigation\n→ Cleanse wound bed, edges\n   & periwound\n→ Reassess at each visit", 13, LIGHT_TEAL, DARK_TEAL, False)

add_shape_with_text(slide, 4.8, 3.8, 4.0, 2.8,
    "Biofilm Suspected / At Risk\n\n→ Consider surfactant-based or\n   antimicrobial cleanser\n→ PHMB, HOCl or Octenidine\n→ Active mechanical cleansing\n→ Treat the cause, not routine", 13, RGBColor(255, 248, 230), DARK_GRAY, False)

add_shape_with_text(slide, 9.1, 3.8, 4.0, 2.8,
    "Infected Wound\n\n→ Antimicrobial cleanser +\n   systemic treatment as needed\n→ Discuss with GP\n→ Swab if clinically indicated\n→ Short-term targeted antiseptic\n→ Step down when resolving", 13, RGBColor(255, 235, 235), RED_ACCENT, False)

# ==================== SLIDE 6: WHAT I'M PROPOSING ====================
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide, WHITE)
add_shape_with_text(slide, 0, 0, 13.333, 1.0, "What I'm Proposing We Consider", 28, TEAL, WHITE, True)

add_multi_text(slide, 0.8, 1.3, 5.5, 5.5, [
    "Immediate — Wound Cleansing",
    "",
    "Switch routine wound cleansing to normal saline or potable water for non-infected wounds",
    "Reserve antiseptics (PHMB, HOCl) for wounds with suspected infection or biofilm",
    "Stop routine chlorhexidine + cetrimide use on healing wounds",
    "Adopt a cleansing decision framework based on wound status (adapted from IWII 2025)",
], 16, DARK_GRAY, True, True)

add_multi_text(slide, 7.0, 1.3, 5.5, 5.5, [
    "Bigger Picture — Where This Fits",
    "",
    "This is step 1 of updating our wound care approach",
    "Future areas: wound assessment & documentation, product selection, evidence-based dressing choices",
    "Potential for nurse-led wound clinics",
    "Aligns with Medicare wound management items and best-practice care",
    "I'd love a GP champion to partner on wound care practice updates",
], 16, DARK_GRAY, True, True)

# Bottom
add_shape_with_text(slide, 2.0, 5.8, 9, 1.2,
    "💡 This isn't about criticism — it's about giving our patients the best chance to heal.\nSmall change, big evidence, better outcomes.",
    18, LIGHT_TEAL, DARK_TEAL, True)

# ==================== SLIDE 7: DISCUSSION ====================
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide, TEAL)

add_textbox(slide, 1, 1.5, 11, 1.2, "Discussion & Questions", 40, True, WHITE, PP_ALIGN.CENTER)

add_textbox(slide, 1, 3.0, 11, 0.8, "What are your thoughts?", 24, False, RGBColor(200, 240, 240), PP_ALIGN.CENTER)

add_multi_text(slide, 2.5, 4.0, 8, 2.5, [
    "Would anyone be interested in championing this with me?",
    "Can we trial saline-first cleansing for 4 weeks?",
    "Would a wound cleansing quick-reference card be useful?",
], 20, RGBColor(200, 240, 240), False, True)

add_textbox(slide, 1, 6.2, 11, 0.8, "Reference: IWII (2025) Therapeutic Wound & Skin Cleansing:\nClinical Evidence and Recommendations. Wounds International.", 14, False, RGBColor(160, 200, 200), PP_ALIGN.CENTER)

# Save
output_path = "/home/user/BeatLab/Wound_Cleansing_Presentation.pptx"
prs.save(output_path)
print(f"Saved to {output_path}")
