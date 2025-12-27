# Requirements Document - RIBIF System
**Industrial 5.0 Production Line Planning & Operations**

**AI Technologies:**
- Gemini 3 Pro & Nano (Google) - AI decision making, negotiations, analysis
- Meshy3D - Image to 3D mesh conversion (generate 3D models from machine images)
- Phone API - Voice calls and negotiations with suppliers

---

## Scenario 1: New Factory Planning

### User: CEO/Project Manager

### Input:
1. **Documents uploaded:**
   - PDF technical specifications
   - DWG/CAD drawings
   - Product requirements document
   - Investment budget document

2. **Text inputs:**
   - Product description: "Polymer facade panels, 2000x1000mm, UV resistant"
   - Quantity: 10,000 units/month
   - Target market: Europe (REACH compliance required)
   - Budget constraint: €5M max investment
   - Timeline: Production start in 6 months

3. **Constraints:**
   - Must use recycled materials (sustainability)
   - ATEX zones required (explosive atmosphere areas)
   - Multi-floor factory preferred

### Process (What System Does):

**Step 1: Document Analysis**
- Extract specifications: dimensions, materials, quantities
- Identify technical requirements
- Extract compliance needs (REACH, ATEX, etc.)

**Step 2: AI Planning (Gemini 3 Pro)**
- Analyze requirements
- Determine production process needed (injection, extrusion, etc.)
- Calculate required machinery
- Estimate factory dimensions

**Step 3: Supplier Sourcing**
- Search suppliers for:
  - Injection molding machines (100T-5000T range)
  - Materials (PU, PP, recycled polymers)
  - Factory equipment (AGV, ASRS, etc.)
- Filter by region, compliance, certifications

**Step 4: Supplier Negotiation (Phone API + Gemini)**
- AI calls supplier phone numbers automatically
- Negotiates prices in multiple languages (FR, AR, EN, DE)
- Gets quotes and delivery times
- Saves all offers to database

**Step 5: 3D Model Generation (Meshy3D)**
- Takes images/photos of machines (if no 3D file available)
- Converts images to 3D mesh models
- Generates complete 3D factory layout

**Step 6: 2D/3D Layout Generation**
- Creates 2D floor plans (DWG/DXF)
- Creates 3D BIM model (IFC format)
- Places machines in optimal positions
- Designs ATEX zones
- Routes AGV paths

**Step 7: Cost Analysis (Gemini 3 Pro)**
- Calculates Total Cost of Ownership (TCO)
- Compares supplier offers
- Generates business plan with ROI
- ANDI/AAPI compliant financial projections

**Step 8: Presentation Generation**
- Creates HD presentation video of factory
- Generates 3D interactive viewer
- Creates visualizations for stakeholders

### Output/Result:

**Complete Factory Planning Package:**

1. **2D Layout Files:**
   - Factory floor plan (DWG/DXF)
   - Equipment placement diagram
   - ATEX zone markings
   - AGV routing paths

2. **3D Models:**
   - Complete factory BIM model (IFC)
   - Individual machine 3D models (GLB/OBJ)
   - Interactive 3D viewer (web-based)
   - Rendered images/animations

3. **Supplier Information:**
   - List of recommended suppliers with contact info
   - Negotiated prices and quotes
   - Delivery schedules
   - Compliance certifications

4. **Financial Reports:**
   - Business plan Excel file
   - TCO analysis
   - ROI projections (5 years)
   - ANDI/AAPI compliant format

5. **Equipment List:**
   - Machines with specifications
   - Prices (negotiated)
   - Installation requirements
   - Energy consumption estimates

6. **Presentation Materials:**
   - HD factory video (5-10 min)
   - 3D visualization
   - Executive summary PDF

7. **Production Plan:**
   - Recommended material selection
   - Process workflow
   - Capacity calculations
   - Quality control plan

---

## Scenario 2: New Product Launch

### User: Product Manager

### Input:
1. **Product specifications:**
   - Text description: "SPC flooring tiles, click-lock system, 1200x200mm"
   - Target quantity: 50,000 units/month
   - Material preference: Recycled SBR content
   - Export market: EU (REACH compliance)

2. **Documents:**
   - Product design drawings (PDF/DWG)
   - Quality standards document

### Process:

**Step 1: Material & Process Decision (Gemini 3 Pro)**
- AI analyzes product requirements
- Selects optimal material: SBR (recycled) + SPC composite
- Chooses process: Extrusion with click-lock molding
- Justifies decision with cost/quality/performance analysis

**Step 2: Supplier Search**
- Finds SBR suppliers (recycled content)
- Finds extrusion equipment suppliers
- Verifies REACH compliance

**Step 3: Supplier Calls (Phone API + Gemini)**
- Calls material suppliers
- Negotiates pricing for recycled SBR
- Calls equipment suppliers
- Gets quotes in multiple languages

**Step 4: 3D Model Creation (Meshy3D)**
- If equipment images available, converts to 3D
- Generates production line 3D model

**Step 5: Production Planning**
- Designs production line layout
- Calculates capacity
- Optimizes workflow

### Output:

1. **Material Recommendation:**
   - Selected material: SBR recycled + SPC
   - Supplier list with prices
   - Compliance certificates

2. **Process Recommendation:**
   - Extrusion process with specifications
   - Equipment needed
   - Production line layout (2D/3D)

3. **Cost Estimate:**
   - Material costs
   - Equipment costs
   - Production cost per unit

4. **3D Production Line Model:**
   - Complete line visualization
   - Equipment placement
   - Material flow diagram

---

## Scenario 3: Ongoing Factory Operations

### User: Factory Manager / Operations Team

### Input (Continuous):
- Real-time sensor data (IoT)
- Production orders
- Machine status
- Material inventory levels

### Process (Real-Time, 24/7):

**Step 1: Digital Twin Monitoring**
- Real-time 3D visualization of factory
- Machine status (running, idle, maintenance)
- Sensor readings (temperature, pressure, vibration)
- Production progress tracking

**Step 2: Predictive Maintenance (Gemini 3 Pro)**
- AI analyzes sensor data
- Predicts machine failures before they happen
- Recommends maintenance schedules
- Calculates risk scores

**Step 3: Production Optimization (Gemini 3 Pro)**
- AI optimizes production schedule
- Assigns orders to machines
- Optimizes for time, cost, or energy
- Handles material selection automatically

**Step 4: Safety Monitoring**
- Monitors ATEX zones (temperature, pressure)
- Alerts on violations
- Tracks compliance

**Step 5: Energy Optimization (Gemini 3 Pro)**
- Analyzes energy consumption
- Recommends optimization strategies
- Calculates savings potential

### Output (Real-Time Dashboard):

1. **Live Factory View:**
   - 3D digital twin showing current state
   - Machine status indicators
   - Production metrics (OEE, quality rate)

2. **Maintenance Alerts:**
   - Predicted failures (risk scores)
   - Recommended maintenance actions
   - Maintenance schedule

3. **Production Schedule:**
   - Optimized order assignments
   - Material recommendations
   - Process parameters

4. **KPIs:**
   - Overall Equipment Effectiveness (OEE)
   - Production rate
   - Quality metrics
   - Energy consumption
   - Cost per unit

5. **Alerts:**
   - Safety violations (ATEX)
   - Machine anomalies
   - Quality issues
   - Inventory warnings

---

## Scenario 4: Supplier Negotiation (Standalone)

### User: Procurement Manager

### Input:
- Supplier name/company
- Product/material needed
- Quantity required
- Target price (optional)
- Language preference

### Process:

**Step 1: Supplier Contact Lookup**
- Finds supplier phone number
- Verifies contact information

**Step 2: AI Voice Call (Phone API + Gemini)**
- System calls supplier automatically
- AI agent introduces itself
- Explains requirements
- Negotiates price in supplier's language
- Discusses delivery terms
- Confirms certifications/compliance

**Step 3: Conversation Recording**
- Full conversation transcript saved
- Key points extracted (price, delivery, terms)
- Stored in database

**Step 4: Follow-up Actions**
- Generates RFQ (Request for Quotation) if needed
- Schedules follow-up call if required
- Creates supplier record

### Output:

1. **Negotiation Summary:**
   - Final negotiated price
   - Delivery time
   - Payment terms
   - Compliance status

2. **Transcript:**
   - Full conversation transcript
   - Key points highlighted

3. **Supplier Record:**
   - Contact information
   - Product catalog
   - Pricing history
   - Performance rating

---

## Scenario 5: Business Plan Generation

### User: Finance Manager / CEO

### Input:
- Project name: "New Polymer Factory - Zone Rouïba"
- Investment amount: €10M
- Target production: 100K units/month
- Products: Polymer panels, SPC flooring
- Market: MENA + Europe
- Timeline: 3-year projection

### Process:

**Step 1: Data Collection (Gemini 3 Pro)**
- Analyzes factory plan data
- Collects equipment costs (from supplier negotiations)
- Estimates operating costs
- Researches market data

**Step 2: Financial Modeling (Gemini 3 Pro)**
- Generates 5-year revenue projections
- Calculates operating expenses
- Estimates CapEx and OpEx
- Applies ANDI/AAPI format requirements

**Step 3: Analysis**
- NPV (Net Present Value) calculation
- IRR (Internal Rate of Return)
- Payback period
- Sensitivity analysis
- Risk assessment

**Step 4: Report Generation**
- Creates Excel business plan
- Formats per ANDI/AAPI requirements
- Adds charts and graphs
- Includes executive summary

### Output:

1. **Business Plan Excel File:**
   - Executive summary
   - Market analysis
   - Financial projections (5 years)
   - Investment breakdown
   - ROI analysis
   - Risk assessment

2. **Financial Metrics:**
   - NPV: €X million
   - IRR: X%
   - Payback: X years
   - Break-even analysis

3. **ANDI/AAPI Format:**
   - Compliant document structure
   - Required sections filled
   - Ready for submission

---

## Scenario 6: 3D Model Generation from Images

### User: Engineering Team

### Input:
1. **Machine images:**
   - Photos of injection molding machine (multiple angles)
   - Equipment specifications document
   - Dimensions and technical data

2. **Request:**
   - "Generate 3D model of this machine for factory layout"

### Process:

**Step 1: Image Processing**
- Upload machine images (front, side, top views)
- System identifies key features
- Extracts dimensions from documents

**Step 2: 3D Generation (Meshy3D)**
- Converts images to 3D mesh
- Reconstructs 3D geometry
- Applies dimensions from specifications
- Creates textured 3D model

**Step 3: Model Refinement (Gemini 3 Pro)**
- AI reviews generated model
- Validates dimensions
- Checks technical accuracy
- Suggests improvements if needed

**Step 4: Integration**
- Adds to equipment library
- Positions in factory layout
- Generates collision detection
- Exports in multiple formats (GLB, OBJ, IFC)

### Output:

1. **3D Model Files:**
   - GLB file (optimized for web)
   - OBJ file (universal format)
   - IFC file (BIM integration)
   - Rendered images (PNG)

2. **Model Properties:**
   - Dimensions (validated)
   - Materials/textures
   - Technical specifications
   - Placement recommendations

3. **Integration:**
   - Added to factory layout
   - Collision check results
   - Space optimization suggestions

---

## System Requirements Summary

### Input Types:
1. **Documents:** PDF, DWG, DXF, Excel, Word
2. **Images:** JPG, PNG (for 3D generation)
3. **Text:** Product descriptions, requirements, constraints
4. **Real-time Data:** IoT sensor feeds, production orders

### Output Types:
1. **2D Plans:** DWG, DXF, PNG
2. **3D Models:** IFC (BIM), GLB, OBJ, FBX
3. **Documents:** Excel, PDF, HTML
4. **Videos:** MP4 (HD/4K)
5. **Data:** JSON, Database records
6. **Dashboards:** Real-time web interfaces

### Key AI Capabilities:
- **Gemini 3 Pro:** Complex reasoning, financial analysis, negotiations, decision making
- **Gemini Nano:** Lightweight tasks, quick responses, real-time operations
- **Meshy3D:** Image-to-3D conversion, mesh generation
- **Phone API:** Voice calls, real-time conversations, multilingual support

### Automation Level:
- **99% Autonomous:** System makes decisions automatically
- **CEO Approval:** Only required for strategic/investment decisions (>€1M)
- **Human Intervention:** Minimal - mainly for validation and exceptions

---

## Success Criteria

### Time Savings:
- Factory planning: Weeks → Hours (90% reduction)
- Supplier sourcing: Days → Hours (80% reduction)
- Business plan: Days → Minutes (95% reduction)
- 3D model generation: Hours → Minutes (85% reduction)

### Cost Savings:
- Supplier negotiations: 15% average price reduction
- Energy optimization: 15-20% reduction
- Preventive maintenance: 30-50% downtime reduction
- External agency costs: €10K-€50K saved per project

### Quality Improvements:
- Specification accuracy: 100% (no human errors)
- Compliance rate: 100% (automatic checking)
- Decision quality: AI-optimized vs. manual estimation
- 3D model accuracy: Validated dimensions and specifications

---

**Document Version:** 1.0  
**Date:** 2025-01-27  
**Focus:** User scenarios and requirements (non-technical)

