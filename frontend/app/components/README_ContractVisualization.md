# Contract Interaction Visualization

This feature provides an interactive visualization of how different contracts in a project interact with each other, highlighting the distinction between internal and external calls.

## Features

### 🎯 Core Functionality
- **Interactive Graph Visualization**: Displays contracts as nodes and their interactions as edges
- **Internal vs External Call Distinction**: Uses different colors and styles to distinguish between internal contract calls and external contract calls
- **Multiple Layout Algorithms**: Supports circular, force-directed, and hierarchical layouts
- **Real-time Filtering**: Filter to show all calls, only internal calls, or only external calls
- **Contract Details Panel**: Click on any contract node to view detailed information about its functions and call patterns

### 🔍 Analysis Capabilities
- **Contract Parsing**: Automatically parses Rust/Soroban contract files to extract function definitions and call patterns
- **Cross-Contract Call Detection**: Identifies calls between different contracts
- **Function-Level Analysis**: Provides detailed information about each function's visibility and call patterns
- **Interaction Statistics**: Shows overall statistics about contract interactions

### 🎨 Visual Design
- **Color Coding**:
  - Green nodes: Soroban contracts
  - Purple nodes: Rust modules
  - Blue edges: Internal calls
  - Red edges: External calls
- **Edge Weight**: Line thickness represents call frequency
- **Interactive Elements**: Hover effects, selection states, and smooth transitions

## Components

### `EnhancedContractVisualizer`
The main visualization component that provides:
- Canvas-based rendering for performance
- Interactive controls for filtering and layout
- Real-time statistics display
- Contract details panel

### `ContractAnalyzer`
The analysis engine that:
- Parses contract source code
- Extracts function definitions and call patterns
- Builds interaction graphs
- Provides statistics and insights

## Usage

### Accessing the Visualization
1. Navigate to the main dashboard
2. Click "Contract Visualization" in the navigation header
3. The visualization will load with sample contract data

### Interacting with the Visualization
- **Click on nodes**: Select a contract to view detailed information
- **Use filters**: Toggle between all/internal/external calls
- **Change layouts**: Switch between circular, force-directed, and hierarchical layouts
- **Hover**: See tooltips and interactive feedback

### Understanding the Display
- **Node size**: Represents the number of connections (larger = more connected)
- **Edge thickness**: Represents call frequency (thicker = more frequent calls)
- **Connection badges**: Small numbers on nodes show total connection count
- **Edge arrows**: Indicate direction of calls

## Technical Implementation

### Architecture
- **Frontend**: React with TypeScript
- **Visualization**: HTML5 Canvas for performance
- **Analysis**: Custom parser for Rust/Soroban contracts
- **State Management**: React hooks for local state

### Data Flow
1. Contract files are parsed by the `ContractAnalyzer`
2. Interaction graphs are built from parsed data
3. Visualization components render the graph
4. User interactions update the display state

### Supported Contract Types
- **Soroban Contracts**: Smart contracts for the Stellar network
- **Rust Modules**: General Rust code modules
- **Cross-Contract Patterns**: Calls between different contracts

## File Structure

```
frontend/app/
├── components/
│   ├── EnhancedContractVisualizer.tsx    # Main visualization component
│   ├── ContractInteractionVisualizer.tsx # Basic visualization (legacy)
│   └── README_ContractVisualization.md   # This documentation
├── lib/
│   └── contractAnalyzer.ts               # Analysis engine
└── visualization/
    └── page.tsx                         # Visualization page
```

## Development Notes

### Extending the Analyzer
To add support for new contract patterns:
1. Update the `ContractAnalyzer` class
2. Add new parsing patterns in `extractFunctionCalls`
3. Update the visualization types as needed

### Adding New Layouts
To implement additional layout algorithms:
1. Add the layout case in `applyLayout`
2. Implement the positioning logic
3. Update the layout selector UI

### Performance Considerations
- Canvas rendering is used for better performance with large graphs
- Layout calculations are optimized with efficient algorithms
- State updates are batched to minimize re-renders

## Future Enhancements

### Planned Features
- **Real-time Updates**: Live monitoring of contract interactions
- **Export Capabilities**: Save visualizations as images or data
- **Advanced Filtering**: Filter by function name, contract type, or call patterns
- **Code Integration**: Direct integration with contract source code
- **Performance Metrics**: Visual representation of gas costs and execution times

### Integration Opportunities
- **Security Analysis**: Combine with existing security scanning features
- **Testing Integration**: Visualize test coverage and interaction patterns
- **Documentation Generation**: Auto-generate interaction diagrams for documentation

## Troubleshooting

### Common Issues
- **No data displayed**: Ensure contract files are properly formatted and accessible
- **Performance issues**: Large contract sets may require pagination or filtering
- **Layout problems**: Some layouts may not work well with very small or very large graphs

### Debug Information
- Check browser console for parsing errors
- Verify contract file paths and accessibility
- Ensure proper TypeScript types are maintained

## Contributing

When contributing to the visualization feature:
1. Maintain TypeScript type safety
2. Follow existing code patterns and naming conventions
3. Add appropriate error handling
4. Update documentation for new features
5. Test with various contract patterns and sizes

This visualization feature provides a powerful tool for understanding contract interactions and identifying potential security issues or optimization opportunities in complex contract systems.
