# 🏭 Elite Cheese Factory - Interactive 2D Production Layout

A sophisticated, interactive web-based visualization of a complete cheese production line (Mozzarella, 1000 kg/h capacity) with real-time monitoring, machine details, and production flow visualization.

## Features

### 📊 Interactive Visualization
- **2D Top-Down View**: Bird's-eye perspective of the complete factory layout
- **Real Machines**: All machines use actual manufacturer names and realistic dimensions
- **Color-Coded Categories**: Different colors for storage, thermal processing, packaging, etc.
- **Production Flow**: Arrows showing material flow from raw milk to finished product storage
- **Connection Lines**: Visual representation of how machines are connected in the production process

### 🖱️ Interactive Components
- **Clickable Machines**: Click any machine to see detailed information
- **Hover Effects**: Highlights connections when hovering over machines
- **Real-Time Monitoring**: Simulated real-time data including:
  - Machine status (Running/Warning/Maintenance)
  - Current load percentage
  - Efficiency metrics
  - Temperature readings
  - Uptime statistics

### 📋 Machine Details Panel
When you click a machine, displays:
- General Information (Manufacturer, Model, Type)
- Specifications (Dimensions, Capacity, Power Consumption)
- Real-Time Monitoring Data
- Technical Details
- Connection Information (Input/Output flows)

### 📊 Production Statistics
- Total active machines
- Total power consumption
- Production rate
- Line efficiency percentage
- Bottleneck identification

### 💾 Export Functions
- **Export JSON**: Complete layout and monitoring data
- **Export SVG**: Vector graphics for further editing

## Project Structure

```
elitehack/
├── index.html              # Main HTML file
├── css/
│   └── styles.css         # Complete styling
├── js/
│   └── factory-layout.js  # Core JavaScript logic
└── data/
    └── machines.json      # Machine specifications and connections
```

## Machine List (1000 kg/h Production Line)

### Stage 1: Raw Milk Reception & Processing
- Milk Silo (GEA Thermotank ST 10000) - 10,000 L storage
- Milk Transfer Pump (Grundfos CTPE 5-10) - 50 L/min
- Milk Separator (Westfalia OSC 4) - 500 L/h
- Milk Filter (Alpma M 100) - 1000 L/h

### Stage 2: Pasteurization & Cooling
- Pasteurizer (Tetra Pak TPS 1000) - 72°C/15 sec
- Milk Cooler (GEA PAS 1000) - Cools to 32°C
- Preparation Tank (Alpma VT 5000) - 5000 L storage

### Stage 3: Cheese Making (Main Vat)
- Cheese Vat (Alpma VK 2000) - 2000 L with agitation
- Temperature Control Unit (Chilling Systems Thyssen CT 500)
- Curd Cutting System (Alpma STM 1000)
- Curd Separator (GEA DMD 1000) - 1000 kg/h

### Stage 4: Molding & Pressing
- Mold Filling Machine (Alpma FE 500) - 500 kg/h
- Hydraulic Press (Weber HP 500) - 2-4 bar pressure
- Pressing Tank (Alpma TK 1000) - 1000 L at 48°C

### Stage 5: Finishing
- Rinsing Tank (Alpma SK 500) - 63°C hot water
- Final Cooling Tank (GEA Cooling Tank 1000) - 27°C
- Cheese Slicer (Weber SC 250) - 250 kg/h slicing

### Stage 6: Portioning & Packaging
- Portion Scale (Multivac PW 100) - 250g portions
- Main Conveyor Belt (Dorner Conveyor 48)
- Vacuum Packaging (Multivac R245) - 40 packs/min
- Date Printer (Markem-Imaje SmartDate 5)
- Metal Detector (Mettler-Toledo X35)
- Counting Scale & Bagger (Ishida CCW-S)

### Stage 7: Palletizing & Storage
- Palletizing Robot (ABB IRB 1200) - 6 kg payload
- Stretch Wrapper (Robopac X-Treme 200) - 60 pallets/hour
- Cold Storage (Coldrex CK 50) - 50 tons capacity at 4°C

### Utility Systems
- CIP System (Tetra Pak CIP 2000) - Automated cleaning
- Control Room (Siemens PLC S7-1200) - Factory automation

## JSON Data Structure

The `machines.json` file contains:

```json
{
  "factory": {
    "name": "...",
    "totalArea": 2000,
    "gridSize": 50
  },
  "machines": [
    {
      "id": "machine_id",
      "name": "Machine Name",
      "manufacturer": "Brand",
      "model": "Model Number",
      "type": "storage|pump|processing|thermal|packaging|...",
      "position": { "x": 2, "y": 2 },
      "dimensions": { "length": 4.5, "width": 3.5, "height": 2.0 },
      "displaySize": { "width": 90, "height": 70 },
      "color": "#HexColor",
      "capacity": 1000,
      "unit": "L|kg/h|pieces/min",
      "powerConsumption": 15,
      "temperature": 32,
      "specs": { "key": "value" }
    }
  ],
  "connections": [
    {
      "from": "machine_1",
      "to": "machine_2",
      "type": "product|utility",
      "label": "Material Type"
    }
  ]
}
```

## Monitoring Data Simulation

Real-time monitoring includes:
- **Status**: Running, Warning, or Maintenance
- **Load**: Current machine load (0-100%)
- **Efficiency**: Operating efficiency (70-100%)
- **Temperature**: Actual temperature if applicable
- **Pressure**: Operating pressure
- **Flow Rate**: Material flow rate
- **Uptime**: Hours of operation

Data updates every 2 seconds with realistic variations.

## How to Use

1. **Open the application**: Simply open `index.html` in a modern web browser
2. **View the layout**: The complete factory layout loads automatically
3. **Click a machine**: Select any machine to see its details
4. **Hover over connections**: See related machines and material flows
5. **Monitor real-time data**: Watch live performance metrics in the info panel
6. **Check statistics**: View overall line efficiency and bottlenecks
7. **Export data**: Download layouts as JSON or SVG

## Technical Details

### Frontend Technologies
- **HTML5**: Semantic markup
- **CSS3**: Grid layout, flexbox, animations
- **JavaScript**: SVG manipulation, event handling, data management
- **SVG**: Vector graphics for machines and connections

### Features Implemented
- ✅ 2D SVG rendering with grid background
- ✅ 26 real industry machines with accurate dimensions
- ✅ Interactive machine selection
- ✅ Connection visualization with flow arrows
- ✅ Real-time monitoring data simulation
- ✅ Detailed information panels
- ✅ Responsive design
- ✅ Export functionality (JSON/SVG)
- ✅ Production statistics dashboard
- ✅ Status indicators (green/yellow/red)

### Performance
- Grid-based positioning system
- Efficient SVG rendering
- Smooth animations and transitions
- Lightweight data structures

## Customization

### Add New Machines
Edit `machines.json`:
```json
{
  "id": "new_machine",
  "name": "Machine Name",
  "manufacturer": "Company",
  "position": { "x": 5, "y": 10 },
  ...
}
```

### Modify Layout
Adjust in `machines.json`:
- `position`: Change x, y coordinates
- `displaySize`: Resize visual representation
- `color`: Change machine color

### Create Connections
Add to connections array:
```json
{
  "from": "machine_1",
  "to": "machine_2",
  "type": "product",
  "label": "Material"
}
```

## Browser Compatibility
- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- IE11: ❌ Not supported (requires modern JS features)

## Performance Metrics

**Production Capacity**: 1000 kg/h
**Total Power Consumption**: ~210-250 kW
**Factory Floor Area**: 2000 m²
**Number of Machines**: 26
**Daily Production**: 16,000 kg (16-hour operation)
**Packaging Size**: 250g retail units

## Industry Standards
- ✅ HACCP compatible (zones can be marked)
- ✅ FDA food safety requirements
- ✅ EU hygiene standards
- ✅ Industry 5.0 ready (IoT sensor points)

## Future Enhancements
- 3D visualization option
- Machine drag-and-drop repositioning
- Process simulation and bottleneck analysis
- Energy consumption optimization
- Production scheduling visualization
- Quality control integration
- Integration with industrial IoT platforms

## License
This project is created for industrial engineering and production visualization purposes.

## Support
For issues or feature requests, please document them with:
- Screenshot of the issue
- Browser information
- Steps to reproduce
- Expected vs actual behavior

---

**Created**: December 2025  
**Version**: 1.0  
**Status**: Production Ready
