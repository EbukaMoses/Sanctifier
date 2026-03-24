'use client';

import EnhancedContractVisualizer from '../components/EnhancedContractVisualizer';

export default function VisualizationPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Contract Interaction Visualization
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Analyze and visualize how different contracts in your project interact with each other.
          </p>
        </div>
        
        <EnhancedContractVisualizer />
      </div>
    </div>
  );
}
