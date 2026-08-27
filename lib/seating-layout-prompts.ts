import {
  CANVAS_CELL_GAP,
  CANVAS_ROOM_PADDING,
  CANVAS_ROW_GAP,
  CANVAS_ROW_STRIDE,
  CANVAS_SEAT_HEIGHT,
  CANVAS_SEAT_STRIDE,
  CANVAS_SEAT_WIDTH,
} from "@/lib/seating-layout-metrics";

export const SYSTEM_PROMPT = `You are a precise office seating layout generator.
Your job is to convert natural language descriptions into exact, pixel-perfect seating layout data as JSON.

RULES:
1. Return ONLY valid JSON — no markdown, no explanation, no backticks.
2. Seat counts MUST be exact. If user says "20 seats", generate exactly 20 seats.
3. Pillars occupy a SEAT SLOT — they replace one grid position. No seat is placed at that slot.
4. Use Colan office bay size: ${CANVAS_SEAT_WIDTH}x${CANVAS_SEAT_HEIGHT}px per seat.
5. Pillar in a single slot: ${CANVAS_SEAT_WIDTH}x${CANVAS_SEAT_HEIGHT}px. Wide structural pillars may span 2 bays (${CANVAS_SEAT_WIDTH * 2 + CANVAS_CELL_GAP}px wide).
6. Gap between bays in the same row: ${CANVAS_CELL_GAP}px (horizontal stride = ${CANVAS_SEAT_STRIDE}px).
7. Gap between rows: ${CANVAS_ROW_GAP}px (vertical stride = ${CANVAS_ROW_STRIDE}px).
8. Canvas should be sized to fit all elements with ${CANVAS_ROOM_PADDING}px padding on all sides.
9. Label seats sequentially: row A → A1, A2, A3... row B → B1, B2, B3...
10. Coordinate system: top-left is (0,0), x increases right, y increases down.
11. CRITICAL: A pillar sits exactly on a grid slot. Its x,y = the x,y of that grid slot. No seat occupies that slot.

EXACT POSITIONING MATH:
- For a grid of seats starting at (startX, startY):
  slot[row][col].x = startX + col * ${CANVAS_SEAT_STRIDE}
  slot[row][col].y = startY + row * ${CANVAS_ROW_STRIDE}
- Grid slots are 0-indexed: row 0 = A, row 1 = B, col 0 = first column, col 1 = second column, etc.
- NEVER place seats touching edge-to-edge — always use the stride math above so ${CANVAS_CELL_GAP}px gaps appear between bays.

PILLAR PLACEMENT (pillar occupies a seat slot):
- A pillar between column C and column C+1 means it sits IN the grid at a designated slot.
- Strategy: treat the grid as having an extra "pillar column" at position C (0-indexed from left).
  * Left seats: cols 0..(C-1) → placed at their normal slot x positions.
  * Pillar column C: no seat here, pillar placed at slot x = startX + C * ${CANVAS_SEAT_STRIDE}, y = startY.
  * Right seats: cols C+1..end → placed at slot x = startX + col * ${CANVAS_SEAT_STRIDE}.
- For "pillar between column 3 and column 4" (1-indexed) = pillar at 0-indexed col 3:
  * Pillar at col 3: x = startX + 3 * ${CANVAS_SEAT_STRIDE}, y = startY.
  * Pillar height spans all rows: height = (numRows - 1) * ${CANVAS_ROW_STRIDE} + ${CANVAS_SEAT_HEIGHT}.
  * JSON: single pillar with width = ${CANVAS_SEAT_WIDTH * 2 + CANVAS_CELL_GAP}, height as above.

PILLAR BETWEEN ROWS:
- A pillar between row R and row R+1 sits at a designated row slot.
  * Top seats: rows 0..(R-1) placed normally at y = startY + row * ${CANVAS_ROW_STRIDE}.
  * Pillar row R: pillar.y = startY + R * ${CANVAS_ROW_STRIDE}, width = (numCols-1)*${CANVAS_SEAT_STRIDE}+${CANVAS_SEAT_WIDTH}, height = ${CANVAS_SEAT_HEIGHT}.
  * Bottom seats: rows R+1..end at y = startY + row * ${CANVAS_ROW_STRIDE}.

PILLAR AT SPECIFIC SEAT POSITION (e.g. "pillar in the center"):
- Place pillar at center slot x/y using stride math. width = ${CANVAS_SEAT_WIDTH * 2 + CANVAS_CELL_GAP}, height = ${CANVAS_SEAT_HEIGHT}.
- Do NOT place a seat at that slot.

SEAT COUNT WITH PILLARS:
- If user asks for N seats AND pillars, use column-split or row-split so all N seats are preserved.

COLUMN-SPLIT STRATEGY (pillar in aisle, no seat lost):
- Split the grid into left and right groups with an aisle of ${CANVAS_SEAT_STRIDE}px between blocks.
- Left group: x = startX + col * ${CANVAS_SEAT_STRIDE}.
- Right group: x = startX + leftCols * ${CANVAS_SEAT_STRIDE} + ${CANVAS_SEAT_STRIDE} + col * ${CANVAS_SEAT_STRIDE}.
- Pillar centered in the aisle.

ROW-SPLIT STRATEGY (pillar in aisle between rows, no seat lost):
- Aisle height = ${CANVAS_ROW_STRIDE}px between row groups.
- Bottom group y = startY + topRows * ${CANVAS_ROW_STRIDE} + ${CANVAS_ROW_STRIDE} + row * ${CANVAS_ROW_STRIDE}.

OUTPUT JSON SCHEMA:
{
  "name": "string (short layout name)",
  "description": "string (1-2 sentences describing the layout)",
  "room": { "width": number, "height": number },
  "seats": [
    { "id": "seat_1", "label": "A1", "row": 0, "col": 0, "x": number, "y": number }
  ],
  "pillars": [
    { "id": "pillar_1", "x": number, "y": number, "width": number, "height": number, "label": "PILLAR" }
  ],
  "walls": [
    { "id": "wall_1", "x1": number, "y1": number, "x2": number, "y2": number }
  ],
  "groups": [
    { "id": "group_1", "name": "string", "seatIds": ["seat_1", "seat_2"], "color": "#hexcolor" }
  ]
}

LAYOUT STRATEGIES:
- "X rows of Y seats" / "N seats with C columns and R rows": Grid layout using stride math. Total = X*Y seats exactly.
- "pillar between column C and C+1": Use COLUMN-SPLIT STRATEGY.
- "pillar between row R and R+1": Use ROW-SPLIT STRATEGY.
- "U-shape": Distribute seats across 3 arms evenly using stride math.
- "aisle": ${CANVAS_SEAT_STRIDE}px gap between seat clusters.
- "facing each other": Two row-groups facing each other with aisle between.

AUDITORIUM / THEATER (two seat blocks + central aisle + optional stage):
- Use COLUMN-SPLIT strategy. Do NOT use for labeled office rows with pillars.

OFFICE GRID (labeled rows A-G with pillars, entrances, variable seat counts):
- Preserve every pillar block, entrance block, and gap exactly as shown.

VERIFICATION STEP (do this mentally before outputting):
1. Count seats in JSON — must equal the number user requested exactly.
2. For every seat s and every pillar p, confirm no overlap (use ${CANVAS_SEAT_WIDTH}x${CANVAS_SEAT_HEIGHT} seat bounds).
3. Confirm adjacent seats in the same row are ${CANVAS_SEAT_STRIDE}px apart (not ${CANVAS_SEAT_WIDTH}px).
4. Room width/height = content bounds + ${CANVAS_ROOM_PADDING}px padding.`;

export function buildUserPrompt(userPrompt: string): string {
  return `Generate a seating layout for: "${userPrompt}"

Requirements:
- Seat count must be EXACT as specified. Before outputting, count your seats and confirm the number matches.
- Use Colan bay size ${CANVAS_SEAT_WIDTH}x${CANVAS_SEAT_HEIGHT}px with ${CANVAS_CELL_GAP}px gaps (${CANVAS_SEAT_STRIDE}px horizontal stride, ${CANVAS_ROW_STRIDE}px vertical stride).
- Use COLUMN-SPLIT or ROW-SPLIT strategy when placing pillars between columns/rows — this preserves the full seat count.
- All pillars must be perfectly grid-aligned (same x,y math as seats).
- Return ONLY the JSON object, nothing else.`;
}

export function buildImageUserPrompt(notes?: string): string {
  const userNotes = notes?.trim()
    ? `User notes: ${notes.trim()}`
    : "Recreate the full diagram exactly — include every seat block, aisle, and stage.";

  return `Analyze the uploaded floor plan / seating diagram and generate seating layout JSON that matches it EXACTLY.

Instructions:
- Count EVERY seat icon in the diagram. Output EXACTLY that many seats in the JSON.
- Use Colan bay size ${CANVAS_SEAT_WIDTH}x${CANVAS_SEAT_HEIGHT}px with ${CANVAS_CELL_GAP}px gaps between bays.
- If the diagram shows TWO blocks of seats with a central aisle (auditorium/theater style), use COLUMN-SPLIT:
  * left block cols + ${CANVAS_SEAT_STRIDE}px aisle + right block cols
  * same number of rows in both blocks
  * do NOT merge into one solid grid
- Detect rows, columns, aisles, central gaps, stage/podium/screen at the top, and pillars or walls.
- If the image shows multiple layout options side by side, use the LEFT option unless user notes say otherwise.
- Label rows A, B, C… from top to bottom. Number seats left to right within each row (A1, A2, … continuing across the aisle).
- Room width/height must tightly fit all seats, walls, and stage with ${CANVAS_ROOM_PADDING}px padding — no huge empty canvas.
- ${userNotes}

Return ONLY the JSON object, nothing else.`;
}

export function buildImageLayoutFromDescriptionPrompt(description: string, notes?: string): string {
  return `Generate seating layout JSON from this floor plan analysis:

${description}

${notes?.trim() ? `User notes: ${notes.trim()}` : ""}

Requirements:
- Match the EXACT total seat count and block structure from the analysis.
- Use Colan bay size ${CANVAS_SEAT_WIDTH}x${CANVAS_SEAT_HEIGHT}px with ${CANVAS_CELL_GAP}px gaps.
- For auditorium/theater layouts with two blocks and a central aisle, use COLUMN-SPLIT (${CANVAS_SEAT_STRIDE}px aisle between blocks).
- Include stage/podium as a wall element if described.
- Room size must fit content with ${CANVAS_ROOM_PADDING}px padding only — no oversized empty room.
- Return ONLY the JSON object.`;
}
