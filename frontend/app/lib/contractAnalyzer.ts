export interface ParsedContract {
  id: string;
  name: string;
  filePath: string;
  type: 'soroban' | 'rust';
  functions: ParsedFunction[];
  imports: string[];
  structs: ParsedStruct[];
}

export interface ParsedFunction {
  name: string;
  visibility: 'public' | 'private';
  isAsync: boolean;
  parameters: Parameter[];
  returnType?: string;
  calls: FunctionCall[];
  line: number;
}

export interface Parameter {
  name: string;
  type: string;
}

export interface FunctionCall {
  targetContract?: string;
  functionName: string;
  type: 'internal' | 'external';
  line: number;
  isContractCall: boolean;
}

export interface ParsedStruct {
  name: string;
  fields: StructField[];
  line: number;
}

export interface StructField {
  name: string;
  type: string;
}

export interface InteractionGraph {
  contracts: ParsedContract[];
  interactions: ContractInteraction[];
}

export interface ContractInteraction {
  fromContract: string;
  fromFunction: string;
  toContract: string;
  toFunction: string;
  type: 'internal' | 'external';
  frequency: number;
  callChain: string[];
}

export class ContractAnalyzer {
  private contracts: Map<string, ParsedContract> = new Map();
  private interactionGraph: InteractionGraph | null = null;

  /**
   * Parse contract files to extract interaction data
   */
  async analyzeContracts(contractFiles: { path: string; content: string }[]): Promise<InteractionGraph> {
    // Parse each contract file
    for (const file of contractFiles) {
      const contract = await this.parseContractFile(file.path, file.content);
      if (contract) {
        this.contracts.set(contract.id, contract);
      }
    }

    // Build interaction graph
    this.interactionGraph = this.buildInteractionGraph();
    
    return this.interactionGraph;
  }

  /**
   * Parse a single contract file
   */
  private async parseContractFile(filePath: string, content: string): Promise<ParsedContract | null> {
    try {
      const lines = content.split('\n');
      const fileName = filePath.split('/').pop() || '';
      const contractId = fileName.replace(/\.(rs|sol)$/, '');
      
      // Determine contract type
      const isSoroban = content.includes('soroban_sdk') || 
                       content.includes('#[contract]') || 
                       content.includes('contractimpl');
      
      const contract: ParsedContract = {
        id: contractId,
        name: this.toPascalCase(contractId),
        filePath,
        type: isSoroban ? 'soroban' : 'rust',
        functions: [],
        imports: this.extractImports(content),
        structs: this.extractStructs(content)
      };

      // Extract functions
      contract.functions = this.extractFunctions(content, contractId);

      return contract;
    } catch (error) {
      console.error(`Error parsing contract file ${filePath}:`, error);
      return undefined;
    }
  }

  /**
   * Extract import statements
   */
  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const importRegex = /use\s+([^;]+);/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1].trim());
    }
    
    return imports;
  }

  /**
   * Extract struct definitions
   */
  private extractStructs(content: string): ParsedStruct[] {
    const structs: ParsedStruct[] = [];
    const structRegex = /pub\s+struct\s+(\w+)\s*\{([^}]+)\}/g;
    let match;
    
    while ((match = structRegex.exec(content)) !== null) {
      const structName = match[1];
      const structBody = match[2];
      const fields = this.extractStructFields(structBody);
      
      structs.push({
        name: structName,
        fields,
        line: this.getLineNumber(content, match.index)
      });
    }
    
    return structs;
  }

  /**
   * Extract fields from struct body
   */
  private extractStructFields(structBody: string): StructField[] {
    const fields: StructField[] = [];
    const fieldLines = structBody.split(',').map(line => line.trim());
    
    for (const line of fieldLines) {
      if (line) {
        const parts = line.split(':').map(part => part.trim());
        if (parts.length === 2) {
          fields.push({
            name: parts[0],
            type: parts[1]
          });
        }
      }
    }
    
    return fields;
  }

  /**
   * Extract function definitions and their calls
   */
  private extractFunctions(content: string, contractId: string): ParsedFunction[] {
    const functions: ParsedFunction[] = [];
    
    // Match function definitions including Soroban contract functions
    const functionRegex = /(?:pub\s+)?(?:async\s+)?fn\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^{]+))?\s*\{/g;
    let match;
    
    while ((match = functionRegex.exec(content)) !== null) {
      const functionName = match[1];
      const parameters = this.parseParameters(match[2]);
      const returnType = match[3]?.trim();
      const isPublic = content.substring(Math.max(0, match.index - 10), match.index).includes('pub');
      const isAsync = match[0].includes('async');
      const line = this.getLineNumber(content, match.index);
      
      // Extract function body to analyze calls
      const functionBody = this.extractFunctionBody(content, match.index);
      const calls = this.extractFunctionCalls(functionBody, contractId);
      
      functions.push({
        name: functionName,
        visibility: isPublic ? 'public' : 'private',
        isAsync,
        parameters,
        returnType,
        calls,
        line
      });
    }
    
    return functions;
  }

  /**
   * Parse function parameters
   */
  private parseParameters(paramString: string): Parameter[] {
    if (!paramString.trim()) return [];
    
    const parameters: Parameter[] = [];
    const paramParts = paramString.split(',').map(part => part.trim());
    
    for (const part of paramParts) {
      const colonIndex = part.lastIndexOf(':');
      if (colonIndex > 0) {
        const name = part.substring(0, colonIndex).trim();
        const type = part.substring(colonIndex + 1).trim();
        parameters.push({ name, type });
      }
    }
    
    return parameters;
  }

  /**
   * Extract function body content
   */
  private extractFunctionBody(content: string, startIndex: number): string {
    const afterBrace = content.indexOf('{', startIndex);
    if (afterBrace === -1) return '';
    
    let braceCount = 1;
    let endIndex = afterBrace + 1;
    
    while (endIndex < content.length && braceCount > 0) {
      if (content[endIndex] === '{') braceCount++;
      else if (content[endIndex] === '}') braceCount--;
      endIndex++;
    }
    
    return content.substring(afterBrace + 1, endIndex - 1);
  }

  /**
   * Extract function calls from function body
   */
  private extractFunctionCalls(functionBody: string, currentContractId: string): FunctionCall[] {
    const calls: FunctionCall[] = [];
    
    // Pattern for function calls: function_name(...) or module::function_name(...)
    const callRegex = /(?:(\w+)::)?(\w+)\s*\(/g;
    let match;
    
    while ((match = callRegex.exec(functionBody)) !== null) {
      const modulePath = match[1];
      const functionName = match[2];
      const line = this.getLineNumber(functionBody, match.index);
      
      // Skip certain common function calls
      if (this.isCommonUtilityFunction(functionName)) {
        continue;
      }
      
      // Determine if this is an external contract call
      let targetContract: string | undefined;
      let callType: 'internal' | 'external' = 'internal';
      let isContractCall = false;
      
      if (modulePath) {
        // Check if module path corresponds to another contract
        const targetContractId = this.findContractByModule(modulePath);
        if (targetContractId && targetContractId !== currentContractId) {
          targetContract = targetContractId;
          callType = 'external';
          isContractCall = true;
        }
      } else {
        // Local function call - check if it's in the same contract
        const isLocalFunction = this.isLocalFunction(functionName, currentContractId);
        if (!isLocalFunction) {
          // Might be a contract call through env.invoke_contract or similar
          isContractCall = this.isContractCallPattern(functionBody, match.index);
          if (isContractCall) {
            callType = 'external';
          }
        }
      }
      
      calls.push({
        targetContract,
        functionName,
        type: callType,
        line,
        isContractCall
      });
    }
    
    // Also check for Soroban contract invocation patterns
    const sorobanCalls = this.extractSorobanContractCalls(functionBody, currentContractId);
    calls.push(...sorobanCalls);
    
    return calls;
  }

  /**
   * Extract Soroban-specific contract calls
   */
  private extractSorobanContractCalls(functionBody: string, currentContractId: string): FunctionCall[] {
    const calls: FunctionCall[] = [];
    
    // Pattern for env.invoke_contract or similar
    const sorobanCallRegex = /env\.invoke_contract\s*\(\s*&(\w+)/g;
    let match;
    
    while ((match = sorobanCallRegex.exec(functionBody)) !== null) {
      const addressVar = match[1];
      const line = this.getLineNumber(functionBody, match.index);
      
      // Try to resolve which contract this address refers to
      const targetContract = this.resolveContractFromAddress(addressVar);
      
      calls.push({
        targetContract,
        functionName: 'invoke_contract',
        type: targetContract && targetContract !== currentContractId ? 'external' : 'internal',
        line,
        isContractCall: true
      });
    }
    
    return calls;
  }

  /**
   * Check if function is a common utility function
   */
  private isCommonUtilityFunction(functionName: string): boolean {
    const commonFunctions = [
      'println', 'format', 'to_string', 'to_vec', 'clone', 'unwrap', 'expect',
      'ok_or', 'map', 'filter', 'fold', 'collect', 'into_iter', 'iter',
      'len', 'is_empty', 'push', 'pop', 'insert', 'remove', 'get', 'set',
      'new', 'default', 'from', 'into', 'try_from', 'try_into',
      'add', 'sub', 'mul', 'div', 'rem', 'checked_add', 'checked_sub',
      'checked_mul', 'checked_div', 'saturating_add', 'saturating_sub',
      'wrapping_add', 'wrapping_sub', 'wrapping_mul', 'wrapping_div'
    ];
    
    return commonFunctions.includes(functionName);
  }

  /**
   * Find contract ID by module path
   */
  private findContractByModule(modulePath: string): string | undefined {
    // Simple heuristic: check if module path matches any contract ID
    for (const [contractId, contract] of this.contracts) {
      if (modulePath.includes(contractId) || contractId.includes(modulePath)) {
        return contractId;
      }
    }
    return undefined;
  }

  /**
   * Check if function is local to the current contract
   */
  private isLocalFunction(functionName: string, contractId: string): boolean {
    const contract = this.contracts.get(contractId);
    if (!contract) return false;
    
    return contract.functions.some(func => func.name === functionName);
  }

  /**
   * Check if the pattern indicates a contract call
   */
  private isContractCallPattern(functionBody: string, index: number): boolean {
    const context = functionBody.substring(Math.max(0, index - 100), index + 100);
    return context.includes('invoke_contract') || 
           context.includes('call') || 
           context.includes('Address');
  }

  /**
   * Resolve contract from address variable (simplified)
   */
  private resolveContractFromAddress(addressVar: string): string | undefined {
    // This is a simplified implementation
    // In practice, you'd need to track variable assignments and constants
    return undefined;
  }

  /**
   * Build interaction graph from parsed contracts
   */
  private buildInteractionGraph(): InteractionGraph {
    const interactions: ContractInteraction[] = [];
    const contracts = Array.from(this.contracts.values());
    
    for (const contract of contracts) {
      for (const func of contract.functions) {
        for (const call of func.calls) {
          if (call.isContractCall || call.targetContract) {
            const targetContract = call.targetContract || this.inferTargetContract(call.functionName);
            
            if (targetContract) {
              interactions.push({
                fromContract: contract.id,
                fromFunction: func.name,
                toContract: targetContract,
                toFunction: call.functionName,
                type: call.type,
                frequency: 1, // Could be enhanced with actual call frequency data
                callChain: [contract.id, targetContract]
              });
            }
          }
        }
      }
    }
    
    return {
      contracts,
      interactions
    };
  }

  /**
   * Infer target contract from function name
   */
  private inferTargetContract(functionName: string): string | undefined {
    // Simple heuristic: check if function name suggests a contract
    for (const [contractId, contract] of this.contracts) {
      if (contract.functions.some(func => func.name === functionName)) {
        return contractId;
      }
    }
    return undefined;
  }

  /**
   * Get line number for a given index in content
   */
  private getLineNumber(content: string, index: number): number {
    const before = content.substring(0, index);
    return before.split('\n').length;
  }

  /**
   * Convert string to PascalCase
   */
  private toPascalCase(str: string): string {
    return str.replace(/(?:^|[-_])(\w)/g, (_, char) => char.toUpperCase());
  }

  /**
   * Get interaction statistics
   */
  getInteractionStats(): {
    totalContracts: number;
    totalInteractions: number;
    internalCalls: number;
    externalCalls: number;
    mostConnectedContract: string | null;
  } {
    if (!this.interactionGraph) {
      return {
        totalContracts: 0,
        totalInteractions: 0,
        internalCalls: 0,
        externalCalls: 0,
        mostConnectedContract: null
      };
    }

    const connectionCounts = new Map<string, number>();
    let internalCalls = 0;
    let externalCalls = 0;

    for (const interaction of this.interactionGraph.interactions) {
      connectionCounts.set(
        interaction.fromContract,
        (connectionCounts.get(interaction.fromContract) || 0) + 1
      );
      
      if (interaction.type === 'internal') {
        internalCalls++;
      } else {
        externalCalls++;
      }
    }

    let mostConnectedContract: string | undefined;
    let maxConnections = 0;

    for (const [contract, count] of connectionCounts) {
      if (count > maxConnections) {
        maxConnections = count;
        mostConnectedContract = contract;
      }
    }

    return {
      totalContracts: this.interactionGraph.contracts.length,
      totalInteractions: this.interactionGraph.interactions.length,
      internalCalls,
      externalCalls,
      mostConnectedContract
    };
  }
}
