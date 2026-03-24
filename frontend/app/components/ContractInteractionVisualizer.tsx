'use client';

import React, { useEffect, useRef, useState } from 'react';

interface Contract {
  id: string;
  name: string;
  type: 'soroban' | 'rust';
  functions: Function[];
  address?: string;
}

interface Function {
  name: string;
  visibility: 'public' | 'private';
  calls: Call[];
}

interface Call {
  targetContract: string;
  functionName: string;
  type: 'internal' | 'external';
  line?: number;
}

interface InteractionData {
  contracts: Contract[];
  interactions: Interaction[];
}

interface Interaction {
  from: string;
  to: string;
  functionName: string;
  type: 'internal' | 'external';
  frequency: number;
}

const ContractInteractionVisualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [interactionData, setInteractionData] = useState<InteractionData | null>(null);
  const [selectedContract, setSelectedContract] = useState<string | null>(null);
  const [hoveredInteraction, setHoveredInteraction] = useState<Interaction | null>(null);
  const [filter, setFilter] = useState<'all' | 'internal' | 'external'>('all');

  // Mock data based on the contract analysis
  const mockInteractionData: InteractionData = {
    contracts: [
      {
        id: 'my-contract',
        name: 'My Contract',
        type: 'soroban',
        functions: [
          {
            name: 'handle_cross_contract_message',
            visibility: 'public',
            calls: [
              { targetContract: 'runtime-guard-wrapper', functionName: 'execute_guarded', type: 'external' },
              { targetContract: 'my-contract', functionName: 'handle_transfer', type: 'internal' },
              { targetContract: 'my-contract', functionName: 'handle_query', type: 'internal' },
              { targetContract: 'my-contract', functionName: 'handle_callback', type: 'internal' }
            ]
          }
        ]
      },
      {
        id: 'runtime-guard-wrapper',
        name: 'Runtime Guard Wrapper',
        type: 'soroban',
        functions: [
          {
            name: 'execute_guarded',
            visibility: 'public',
            calls: [
              { targetContract: 'runtime-guard-wrapper', functionName: 'pre_execution_guards', type: 'internal' },
              { targetContract: 'runtime-guard-wrapper', functionName: 'execute_with_monitoring', type: 'internal' },
              { targetContract: 'runtime-guard-wrapper', functionName: 'post_execution_guards', type: 'internal' }
            ]
          },
          {
            name: 'pre_execution_guards',
            visibility: 'private',
            calls: [
              { targetContract: 'runtime-guard-wrapper', functionName: 'validate_storage_integrity', type: 'internal' }
            ]
          }
        ]
      },
      {
        id: 'vulnerable-contract',
        name: 'Vulnerable Contract',
        type: 'soroban',
        functions: [
          {
            name: 'set_admin',
            visibility: 'public',
            calls: []
          },
          {
            name: 'set_admin_secure',
            visibility: 'public',
            calls: []
          }
        ]
      },
      {
        id: 'amm-pool',
        name: 'AMM Pool',
        type: 'rust',
        functions: [
          {
            name: 'calculate_swap_output',
            visibility: 'public',
            calls: []
          },
          {
            name: 'calculate_liquidity_mint',
            visibility: 'public',
            calls: []
          }
        ]
      },
      {
        id: 'reentrancy-guard',
        name: 'Reentrancy Guard',
        type: 'soroban',
        functions: [
          {
            name: 'protected_function',
            visibility: 'public',
            calls: [
              { targetContract: 'reentrancy-guard', functionName: 'internal_logic', type: 'internal' }
            ]
          }
        ]
      }
    ],
    interactions: [
      { from: 'my-contract', to: 'runtime-guard-wrapper', functionName: 'execute_guarded', type: 'external', frequency: 5 },
      { from: 'runtime-guard-wrapper', to: 'runtime-guard-wrapper', functionName: 'pre_execution_guards', type: 'internal', frequency: 10 },
      { from: 'runtime-guard-wrapper', to: 'runtime-guard-wrapper', functionName: 'post_execution_guards', type: 'internal', frequency: 10 },
      { from: 'my-contract', to: 'my-contract', functionName: 'handle_transfer', type: 'internal', frequency: 8 },
      { from: 'my-contract', to: 'my-contract', functionName: 'handle_query', type: 'internal', frequency: 6 },
      { from: 'reentrancy-guard', to: 'reentrancy-guard', functionName: 'internal_logic', type: 'internal', frequency: 4 }
    ]
  };

  useEffect(() => {
    setInteractionData(mockInteractionData);
  }, []);

  useEffect(() => {
    if (interactionData && canvasRef.current) {
      drawVisualization();
    }
  }, [interactionData, selectedContract, filter]);

  const drawVisualization = () => {
    const canvas = canvasRef.current;
    if (!canvas || !interactionData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Position contracts in a circle
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.3;

    const contractPositions = new Map<string, { x: number; y: number }>();
    
    interactionData.contracts.forEach((contract, index) => {
      const angle = (index * 2 * Math.PI) / interactionData.contracts.length;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      contractPositions.set(contract.id, { x, y });
    });

    // Draw interactions
    const filteredInteractions = interactionData.interactions.filter(
      interaction => filter === 'all' || interaction.type === filter
    );

    filteredInteractions.forEach(interaction => {
      const from = contractPositions.get(interaction.from);
      const to = contractPositions.get(interaction.to);
      
      if (from && to) {
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        
        // Draw curved lines for self-calls
        if (interaction.from === interaction.to) {
          const controlX = from.x + 50;
          const controlY = from.y - 50;
          ctx.quadraticCurveTo(controlX, controlY, to.x, to.y);
        } else {
          ctx.lineTo(to.x, to.y);
        }
        
        // Style based on interaction type
        if (interaction.type === 'external') {
          ctx.strokeStyle = '#ef4444'; // red for external
          ctx.lineWidth = 2 + interaction.frequency * 0.5;
        } else {
          ctx.strokeStyle = '#3b82f6'; // blue for internal
          ctx.lineWidth = 1 + interaction.frequency * 0.3;
        }
        
        ctx.stroke();
        
        // Draw arrow
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const arrowLength = 10;
        const arrowAngle = Math.PI / 6;
        
        ctx.beginPath();
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(
          to.x - arrowLength * Math.cos(angle - arrowAngle),
          to.y - arrowLength * Math.sin(angle - arrowAngle)
        );
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(
          to.x - arrowLength * Math.cos(angle + arrowAngle),
          to.y - arrowLength * Math.sin(angle + arrowAngle)
        );
        ctx.stroke();
      }
    });

    // Draw contract nodes
    interactionData.contracts.forEach(contract => {
      const pos = contractPositions.get(contract.id);
      if (!pos) return;
      
      // Node styling
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 30, 0, 2 * Math.PI);
      
      if (selectedContract === contract.id) {
        ctx.fillStyle = '#fbbf24'; // yellow for selected
      } else if (contract.type === 'soroban') {
        ctx.fillStyle = '#10b981'; // green for soroban
      } else {
        ctx.fillStyle = '#8b5cf6'; // purple for rust
      }
      
      ctx.fill();
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw contract name
      ctx.fillStyle = '#1f2937';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(contract.name, pos.x, pos.y + 50);
    });
  };

  const getContractDetails = (contractId: string) => {
    if (!interactionData) return null;
    return interactionData.contracts.find(c => c.id === contractId);
  };

  const getInteractionStats = () => {
    if (!interactionData) return { total: 0, internal: 0, external: 0 };
    
    const stats = interactionData.interactions.reduce(
      (acc, interaction) => {
        acc.total++;
        if (interaction.type === 'internal') acc.internal++;
        else acc.external++;
        return acc;
      },
      { total: 0, internal: 0, external: 0 }
    );
    
    return stats;
  };

  if (!interactionData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading contract interaction data...</div>
      </div>
    );
  }

  const stats = getInteractionStats();

  return (
    <div className="w-full p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Contract Interaction Visualizer</h2>
        <p className="text-gray-600">
          Visualize how contracts interact with each other, distinguishing between internal and external calls.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-blue-600 text-sm font-medium">Total Interactions</div>
          <div className="text-2xl font-bold text-blue-900">{stats.total}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-green-600 text-sm font-medium">Internal Calls</div>
          <div className="text-2xl font-bold text-green-900">{stats.internal}</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-red-600 text-sm font-medium">External Calls</div>
          <div className="text-2xl font-bold text-red-900">{stats.external}</div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'all'
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All Calls
        </button>
        <button
          onClick={() => setFilter('internal')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'internal'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Internal Only
        </button>
        <button
          onClick={() => setFilter('external')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'external'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          External Only
        </button>
      </div>

      {/* Main Visualization */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <div className="bg-gray-50 rounded-lg p-4">
            <canvas
              ref={canvasRef}
              className="w-full h-96 bg-white rounded-lg shadow-inner"
              onMouseMove={(e) => {
                // Handle hover interactions for displaying tooltips
                const rect = canvasRef.current?.getBoundingClientRect();
                if (rect) {
                  const x = e.clientX - rect.left;
                  const y = e.clientY - rect.top;
                  // Add logic to detect if hovering over an interaction
                }
              }}
            />
          </div>
          
          {/* Legend */}
          <div className="mt-4 flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded-full"></div>
              <span className="text-gray-600">Soroban Contract</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-purple-500 rounded-full"></div>
              <span className="text-gray-600">Rust Module</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-blue-500"></div>
              <span className="text-gray-600">Internal Call</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-1 bg-red-500"></div>
              <span className="text-gray-600">External Call</span>
            </div>
          </div>
        </div>

        {/* Contract Details Panel */}
        <div className="col-span-1">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Contract Details</h3>
            
            {selectedContract ? (
              <div>
                {(() => {
                  const contract = getContractDetails(selectedContract);
                  return contract ? (
                    <div>
                      <div className="mb-4">
                        <h4 className="font-medium text-gray-700">{contract.name}</h4>
                        <p className="text-sm text-gray-500">Type: {contract.type}</p>
                        <p className="text-sm text-gray-500">Functions: {contract.functions.length}</p>
                      </div>
                      
                      <div className="space-y-2">
                        <h5 className="text-sm font-medium text-gray-600">Functions:</h5>
                        {contract.functions.map(func => (
                          <div key={func.name} className="bg-white p-2 rounded border">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{func.name}</span>
                              <span className={`text-xs px-2 py-1 rounded ${
                                func.visibility === 'public' 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {func.visibility}
                              </span>
                            </div>
                            {func.calls.length > 0 && (
                              <div className="mt-2 text-xs text-gray-500">
                                Calls: {func.calls.length} ({func.calls.filter(c => c.type === 'internal').length} internal, {func.calls.filter(c => c.type === 'external').length} external)
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Click on a contract node to view details</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractInteractionVisualizer;
