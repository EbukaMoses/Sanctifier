'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ContractAnalyzer, InteractionGraph, ParsedContract, ContractInteraction } from '../lib/contractAnalyzer';

interface VisualizationNode {
  id: string;
  name: string;
  x: number;
  y: number;
  type: 'soroban' | 'rust';
  level: number;
  connections: number;
}

interface VisualizationEdge {
  from: string;
  to: string;
  type: 'internal' | 'external';
  weight: number;
  label: string;
}

const EnhancedContractVisualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [analyzer] = useState(() => new ContractAnalyzer());
  const [interactionGraph, setInteractionGraph] = useState<InteractionGraph | null>(null);
  const [nodes, setNodes] = useState<VisualizationNode[]>([]);
  const [edges, setEdges] = useState<VisualizationEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'internal' | 'external'>('all');
  const [layout, setLayout] = useState<'circular' | 'force' | 'hierarchical'>('circular');
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);

  // Load and analyze contract data
  useEffect(() => {
    loadContractData();
  }, []);

  // Update visualization when data changes
  useEffect(() => {
    if (interactionGraph) {
      updateVisualization();
    }
  }, [interactionGraph, filter, layout]);

  const loadContractData = async () => {
    setIsLoading(true);
    try {
      // In a real implementation, this would fetch actual contract files
      // For now, we'll use mock data based on the actual contracts found
      const mockContractFiles = [
        {
          path: '/contracts/my-contract/src/lib.rs',
          content: `
use borsh::{BorshDeserialize, BorshSerialize};

#[derive(Debug, BorshSerialize, BorshDeserialize, Clone)]
pub struct CrossContractMessage {
    pub sender: [u8; 32],
    pub method_id: u8,
    pub payload: Vec<u8>,
    pub nonce: u64,
}

pub fn handle_cross_contract_message(raw: &[u8]) -> Result<String, ContractError> {
    let msg = CrossContractMessage::try_from_slice(raw)
        .map_err(|_| ContractError::DeserializationFailed)?;
    match msg.method_id {
        0 => handle_transfer(&msg.payload),
        1 => handle_query(&msg.payload),
        2 => handle_callback(&msg.payload),
        _ => Err(ContractError::UnknownMethod),
    }
}

fn handle_transfer(payload: &[u8]) -> Result<String, ContractError> {
    if payload.len() < 8 {
        return Err(ContractError::InvalidPayload("too short".into()));
    }
    let amount = u64::from_le_bytes(payload[0..8].try_into().unwrap());
    let fee = amount.checked_mul(3).ok_or(ContractError::OverflowDetected)?;
    Ok(format!("transfer: amount={amount}, fee={fee}"))
}
          `
        },
        {
          path: '/contracts/runtime-guard-wrapper/src/lib.rs',
          content: `
use soroban_sdk::{contract, contractimpl, Address, Env, Error, IntoVal, Symbol, Val, Vec};

#[contract]
pub struct RuntimeGuardWrapper;

#[contractimpl]
impl RuntimeGuardWrapper {
    pub fn execute_guarded(env: Env, function_name: Symbol, args: Vec<Val>) -> Result<Val, Error> {
        Self::pre_execution_guards(env.clone())?;
        let result = Self::execute_with_monitoring(env.clone(), &function_name, &args)?;
        Self::post_execution_guards(env.clone())?;
        Self::log_execution(env.clone(), &function_name, &result);
        Ok(result)
    }

    fn pre_execution_guards(env: Env) -> Result<(), Error> {
        Self::validate_storage_integrity(env.clone())?;
        Ok(())
    }

    fn execute_with_monitoring(env: Env, function_name: &Symbol, _args: &Vec<Val>) -> Result<Val, Error> {
        let start_tick = env.ledger().timestamp();
        let result = Val::default();
        Self::record_metrics(env, start_tick);
        Ok(result)
    }
}
          `
        },
        {
          path: '/contracts/vulnerable-contract/src/lib.rs',
          content: `
use soroban_sdk::{contract, contractimpl, symbol_short, Env, Symbol};

#[contract]
pub struct VulnerableContract;

#[contractimpl]
impl VulnerableContract {
    pub fn set_admin(env: Env, new_admin: Symbol) {
        env.storage()
            .instance()
            .set(&symbol_short!("admin"), &new_admin);
    }

    pub fn set_admin_secure(env: Env, new_admin: Symbol) {
        let _admin: Symbol = env
            .storage()
            .instance()
            .get(&symbol_short!("admin"))
            .expect("Admin not set");
        env.storage()
            .instance()
            .set(&symbol_short!("admin"), &new_admin);
    }
}
          `
        }
      ];

      const graph = await analyzer.analyzeContracts(mockContractFiles);
      setInteractionGraph(graph);
      
      const analyzerStats = analyzer.getInteractionStats();
      setStats(analyzerStats);
    } catch (error) {
      console.error('Error loading contract data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateVisualization = useCallback(() => {
    if (!interactionGraph) return;

    const newNodes = createNodes(interactionGraph);
    const newEdges = createEdges(interactionGraph);
    
    setNodes(newNodes);
    setEdges(newEdges);
  }, [interactionGraph, filter]);

  const createNodes = (graph: InteractionGraph): VisualizationNode[] => {
    return graph.contracts.map((contract, index) => {
      const connections = graph.interactions.filter(
        interaction => interaction.fromContract === contract.id || interaction.toContract === contract.id
      ).length;

      return {
        id: contract.id,
        name: contract.name,
        x: 0,
        y: 0,
        type: contract.type,
        level: 0,
        connections
      };
    });
  };

  const createEdges = (graph: InteractionGraph): VisualizationEdge[] => {
    return graph.interactions
      .filter(interaction => filter === 'all' || interaction.type === filter)
      .map(interaction => ({
        from: interaction.fromContract,
        to: interaction.toContract,
        type: interaction.type,
        weight: interaction.frequency,
        label: interaction.toFunction
      }));
  };

  const applyLayout = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    const updatedNodes = [...nodes];

    switch (layout) {
      case 'circular':
        const radius = Math.min(width, height) * 0.3;
        updatedNodes.forEach((node, index) => {
          const angle = (index * 2 * Math.PI) / updatedNodes.length;
          node.x = centerX + radius * Math.cos(angle);
          node.y = centerY + radius * Math.sin(angle);
        });
        break;

      case 'force':
        // Simple force-directed layout
        const iterations = 50;
        const k = Math.sqrt((width * height) / updatedNodes.length) * 0.5;
        
        // Initialize random positions
        updatedNodes.forEach(node => {
          node.x = Math.random() * width;
          node.y = Math.random() * height;
        });

        for (let iter = 0; iter < iterations; iter++) {
          // Repulsive forces between all nodes
          for (let i = 0; i < updatedNodes.length; i++) {
            for (let j = i + 1; j < updatedNodes.length; j++) {
              const dx = updatedNodes[j].x - updatedNodes[i].x;
              const dy = updatedNodes[j].y - updatedNodes[i].y;
              const distance = Math.sqrt(dx * dx + dy * dy) || 1;
              const force = (k * k) / distance;
              
              updatedNodes[i].x -= (dx / distance) * force;
              updatedNodes[i].y -= (dy / distance) * force;
              updatedNodes[j].x += (dx / distance) * force;
              updatedNodes[j].y += (dy / distance) * force;
            }
          }

          // Attractive forces for connected nodes
          edges.forEach(edge => {
            const sourceNode = updatedNodes.find(n => n.id === edge.from);
            const targetNode = updatedNodes.find(n => n.id === edge.to);
            
            if (sourceNode && targetNode) {
              const dx = targetNode.x - sourceNode.x;
              const dy = targetNode.y - sourceNode.y;
              const distance = Math.sqrt(dx * dx + dy * dy) || 1;
              const force = (distance * distance) / k;
              
              sourceNode.x += (dx / distance) * force * 0.5;
              sourceNode.y += (dy / distance) * force * 0.5;
              targetNode.x -= (dx / distance) * force * 0.5;
              targetNode.y -= (dy / distance) * force * 0.5;
            }
          });

          // Keep nodes within canvas bounds
          updatedNodes.forEach(node => {
            node.x = Math.max(30, Math.min(width - 30, node.x));
            node.y = Math.max(30, Math.min(height - 30, node.y));
          });
        }
        break;

      case 'hierarchical':
        // Simple hierarchical layout based on connections
        const levels = new Map<string, number>();
        const visited = new Set<string>();
        
        // Find root nodes (nodes with only outgoing edges)
        updatedNodes.forEach(node => {
          const hasIncoming = edges.some(edge => edge.to === node.id);
          if (!hasIncoming) {
            levels.set(node.id, 0);
          }
        });

        // Assign levels based on connections
        let changed = true;
        while (changed) {
          changed = false;
          edges.forEach(edge => {
            if (levels.has(edge.from) && !levels.has(edge.to)) {
              levels.set(edge.to, (levels.get(edge.from) || 0) + 1);
              changed = true;
            }
          });
        }

        // Position nodes by level
        const nodesByLevel = new Map<number, VisualizationNode[]>();
        updatedNodes.forEach(node => {
          const level = levels.get(node.id) || 0;
          if (!nodesByLevel.has(level)) {
            nodesByLevel.set(level, []);
          }
          nodesByLevel.get(level)!.push(node);
        });

        nodesByLevel.forEach((nodesAtLevel, level) => {
          const levelY = 50 + level * (height - 100) / Math.max(nodesByLevel.size, 1);
          const levelWidth = width / (nodesAtLevel.length + 1);
          
          nodesAtLevel.forEach((node, index) => {
            node.x = levelWidth * (index + 1);
            node.y = levelY;
            node.level = level;
          });
        });
        break;
    }

    setNodes(updatedNodes);
  }, [nodes, edges, layout]);

  useEffect(() => {
    applyLayout();
  }, [applyLayout]);

  // Draw visualization
  useEffect(() => {
    drawVisualization();
  }, [nodes, edges, selectedNode, hoveredNode]);

  const drawVisualization = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw edges
    edges.forEach(edge => {
      const fromNode = nodes.find(n => n.id === edge.from);
      const toNode = nodes.find(n => n.id === edge.to);
      
      if (fromNode && toNode) {
        ctx.beginPath();
        ctx.moveTo(fromNode.x, fromNode.y);
        
        // Draw curved line for self-loops
        if (edge.from === edge.to) {
          const controlX = fromNode.x + 50;
          const controlY = fromNode.y - 50;
          ctx.quadraticCurveTo(controlX, controlY, toNode.x, toNode.y);
        } else {
          ctx.lineTo(toNode.x, toNode.y);
        }
        
        // Style based on edge type
        if (edge.type === 'external') {
          ctx.strokeStyle = '#ef4444'; // red for external
          ctx.lineWidth = Math.min(5, 1 + edge.weight * 0.5);
        } else {
          ctx.strokeStyle = '#3b82f6'; // blue for internal
          ctx.lineWidth = Math.min(3, 1 + edge.weight * 0.3);
        }
        
        ctx.globalAlpha = selectedNode && selectedNode !== edge.from && selectedNode !== edge.to ? 0.3 : 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
        
        // Draw arrow
        if (edge.from !== edge.to) {
          const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
          const arrowLength = 10;
          const arrowAngle = Math.PI / 6;
          const arrowX = toNode.x - 30 * Math.cos(angle);
          const arrowY = toNode.y - 30 * Math.sin(angle);
          
          ctx.beginPath();
          ctx.moveTo(arrowX, arrowY);
          ctx.lineTo(
            arrowX - arrowLength * Math.cos(angle - arrowAngle),
            arrowY - arrowLength * Math.sin(angle - arrowAngle)
          );
          ctx.moveTo(arrowX, arrowY);
          ctx.lineTo(
            arrowX - arrowLength * Math.cos(angle + arrowAngle),
            arrowY - arrowLength * Math.sin(angle + arrowAngle)
          );
          ctx.stroke();
        }
        
        // Draw label
        if (edge.label) {
          const midX = (fromNode.x + toNode.x) / 2;
          const midY = (fromNode.y + toNode.y) / 2;
          ctx.fillStyle = '#6b7280';
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(edge.label, midX, midY - 5);
        }
      }
    });

    // Draw nodes
    nodes.forEach(node => {
      const isSelected = selectedNode === node.id;
      const isHovered = hoveredNode === node.id;
      const radius = 25 + node.connections * 2;
      
      // Node shadow
      if (isSelected || isHovered) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
      }
      
      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
      
      if (isSelected) {
        ctx.fillStyle = '#fbbf24'; // yellow for selected
      } else if (isHovered) {
        ctx.fillStyle = '#fde68a'; // light yellow for hovered
      } else if (node.type === 'soroban') {
        ctx.fillStyle = '#10b981'; // green for soroban
      } else {
        ctx.fillStyle = '#8b5cf6'; // purple for rust
      }
      
      ctx.fill();
      ctx.shadowColor = 'transparent';
      
      // Node border
      ctx.strokeStyle = isSelected ? '#1f2937' : '#e5e7eb';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();
      
      // Node label
      ctx.fillStyle = '#1f2937';
      ctx.font = isSelected ? 'bold 12px sans-serif' : '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.name, node.x, node.y);
      
      // Connection count badge
      if (node.connections > 0) {
        ctx.beginPath();
        ctx.arc(node.x + radius - 5, node.y - radius + 5, 10, 0, 2 * Math.PI);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(node.connections.toString(), node.x + radius - 5, node.y - radius + 5);
      }
    });
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Find clicked node
    const clickedNode = nodes.find(node => {
      const distance = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
      return distance <= 30 + node.connections * 2;
    });

    setSelectedNode(clickedNode ? clickedNode.id : null);
  };

  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Find hovered node
    const hoveredNodeFound = nodes.find(node => {
      const distance = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
      return distance <= 30 + node.connections * 2;
    });

    setHoveredNode(hoveredNodeFound ? hoveredNodeFound.id : null);
    canvas.style.cursor = hoveredNodeFound ? 'pointer' : 'default';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Analyzing contracts...</div>
      </div>
    );
  }

  if (!interactionGraph) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">No contract data available</div>
      </div>
    );
  }

  const selectedContract = selectedNode ? interactionGraph.contracts.find(c => c.id === selectedNode) : null;

  return (
    <div className="w-full p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Enhanced Contract Interaction Visualizer</h2>
        <p className="text-gray-600">
          Interactive visualization of contract interactions with internal vs external call analysis.
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-blue-600 text-sm font-medium">Total Contracts</div>
            <div className="text-2xl font-bold text-blue-900">{stats.totalContracts}</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-gray-600 text-sm font-medium">Total Interactions</div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalInteractions}</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-green-600 text-sm font-medium">Internal Calls</div>
            <div className="text-2xl font-bold text-green-900">{stats.internalCalls}</div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="text-red-600 text-sm font-medium">External Calls</div>
            <div className="text-2xl font-bold text-red-900">{stats.externalCalls}</div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex gap-2">
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

        <div className="flex gap-2">
          <button
            onClick={() => setLayout('circular')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              layout === 'circular'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Circular
          </button>
          <button
            onClick={() => setLayout('force')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              layout === 'force'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Force-Directed
          </button>
          <button
            onClick={() => setLayout('hierarchical')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              layout === 'hierarchical'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Hierarchical
          </button>
        </div>
      </div>

      {/* Main Visualization */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <div className="bg-gray-50 rounded-lg p-4">
            <canvas
              ref={canvasRef}
              className="w-full h-96 bg-white rounded-lg shadow-inner"
              onClick={handleCanvasClick}
              onMouseMove={handleCanvasMouseMove}
            />
          </div>
          
          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm">
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
                <div className="mb-4">
                  <h4 className="font-medium text-gray-700">{selectedContract.name}</h4>
                  <p className="text-sm text-gray-500">Type: {selectedContract.type}</p>
                  <p className="text-sm text-gray-500">Functions: {selectedContract.functions.length}</p>
                  <p className="text-sm text-gray-500">File: {selectedContract.filePath}</p>
                </div>
                
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-gray-600">Functions:</h5>
                  {selectedContract.functions.map(func => (
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
            ) : (
              <p className="text-gray-500 text-sm">Click on a contract node to view details</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedContractVisualizer;
