/**
 * RL Optimizer Cloudflare Worker with FULL Q-LEARNING
 * Optimizes content using Q-learning with persistent Q-table in KV storage
 */

import { QLearningKV } from './lib/rl/qlearning-kv';

export interface Env {
	OPENAI_API_KEY: string;
	RL_STORAGE: KVNamespace;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		// CORS headers
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		};

		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		if (request.method !== 'POST') {
			return new Response('Method not allowed', {
				status: 405,
				headers: corsHeaders,
			});
		}

		try {
			const { userQuery, objective, useCase } = await request.json() as any;

			console.log('[RL] Starting optimization:', { userQuery, useCase });

			// STEP 1: Initialize Q-learning
			const config = {
				learningRate: 0.1,
				discountFactor: 0.95,
				epsilon: 0.2,
				epsilonDecay: 0.995,
				minEpsilon: 0.01,
			};

			const qlearning = new QLearningKV(config, env.RL_STORAGE, 'qtable');
			await qlearning.loadQTable();

			console.log(`[RL] Q-table loaded: ${qlearning.getQTableSize()} states, epsilon: ${qlearning.getEpsilon()}`);

			// STEP 2: Generate initial output
			const systemPrompt = objective?.systemPrompt || getDefaultSystemPrompt(useCase);
			let currentOutput = await generateOutput(env, userQuery, systemPrompt, objective?.constraints);

			// STEP 3: Q-learning optimization loop
			const possibleActions = ['refine_clarity', 'adjust_tone', 'add_details', 'simplify', 'restructure'];
			const maxIterations = 6;
			let iterations = 0;
			let finalReward = 0;

			while (iterations < maxIterations) {
				iterations++;
				console.log(`[RL] Iteration ${iterations}`);

				// Evaluate current output
				const reward = evaluateOutput(currentOutput, objective?.constraints || {});
				finalReward = reward;

				console.log(`[RL] Iteration ${iterations} reward: ${reward}`);

				// Early stopping if converged
				if (reward >= 70) {
					console.log(`[RL] Converged at iteration ${iterations} with reward ${reward}`);
					break;
				}

				// Extract state
				const state = extractState(useCase, objective?.goal || '', objective?.constraints || {});

				// Select action using epsilon-greedy
				const action = qlearning.selectAction(state, possibleActions);
				console.log(`[RL] Selected action: ${action}`);

				// Apply action to generate new output
				const actionPrompt = buildActionPrompt(currentOutput, action, objective?.constraints || {});
				const newOutput = await generateOutput(env, userQuery, actionPrompt, objective?.constraints);
				const newReward = evaluateOutput(newOutput, objective?.constraints || {});

				console.log(`[RL] New reward: ${newReward}`);

				// Update Q-value using Bellman equation
				const nextState = state; // Simplified - same state
				qlearning.updateQValue(state, action, newReward, nextState, possibleActions);

				// Use new output if better
				if (newReward > reward) {
					currentOutput = newOutput;
					finalReward = newReward;
					console.log(`[RL] Accepted new output (${newReward} > ${reward})`);
				} else {
					console.log(`[RL] Rejected new output (${newReward} <= ${reward})`);
				}

				// Decay epsilon (reduce exploration over time)
				qlearning.decayEpsilon();
			}

			// STEP 4: Save Q-table back to KV
			await qlearning.saveQTable();

			console.log(`[RL] Optimization complete: ${iterations} iterations, reward: ${finalReward}, Q-table: ${qlearning.getQTableSize()} states`);

			return new Response(JSON.stringify({
				optimizedOutput: currentOutput,
				iterations,
				finalReward,
				converged: finalReward >= 70,
				qtableSize: qlearning.getQTableSize(),
				epsilon: qlearning.getEpsilon()
			}), {
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});

		} catch (error: any) {
			console.error('[RL] Error:', error);
			return new Response(JSON.stringify({
				error: error.message,
				stack: error.stack
			}), {
				status: 500,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}
	},
};


// Helper functions for Q-learning

async function generateOutput(env: Env, userQuery: string, systemPrompt: string, constraints: any): Promise<string> {
	const optimizationPrompt = `Optimize the following text based on these constraints:

Constraints: ${JSON.stringify(constraints || {})}

Original text:
"${userQuery}"

Return ONLY the optimized version of the text, nothing else.`;

	const response = await fetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: 'gpt-4o-mini',
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: optimizationPrompt },
			],
			max_tokens: 500,
			temperature: 0.8,
		}),
	});

	const data = await response.json() as any;
	return data.choices[0].message.content;
}

function evaluateOutput(output: string, constraints: any): number {
	let score = 50; // Base score

	// Check mustInclude
	if (constraints.mustInclude && Array.isArray(constraints.mustInclude)) {
		for (const term of constraints.mustInclude) {
			if (output.toLowerCase().includes(term.toLowerCase())) {
				score += 10;
			} else {
				score -= 15;
			}
		}
	}

	// Check mustAvoid
	if (constraints.mustAvoid && Array.isArray(constraints.mustAvoid)) {
		for (const term of constraints.mustAvoid) {
			if (output.toLowerCase().includes(term.toLowerCase())) {
				score -= 20;
			}
		}
	}

	// Check length
	if (constraints.maxLength && output.length > constraints.maxLength) {
		score -= 10;
	}
	if (constraints.minLength && output.length < constraints.minLength) {
		score -= 10;
	}

	return Math.max(0, Math.min(100, score));
}

function extractState(useCase: string, goal: string, constraints: any): string {
	const tone = constraints.tone || 'neutral';
	const hasAvoid = constraints.mustAvoid && constraints.mustAvoid.length > 0;
	return `useCase:${useCase}|goal:${goal}|tone:${tone}|hasAvoid:${hasAvoid}`;
}

function buildActionPrompt(currentOutput: string, action: string, constraints: any): string {
	const actionInstructions: Record<string, string> = {
		'refine_clarity': 'Make the text clearer and more concise while maintaining its meaning.',
		'adjust_tone': `Adjust the tone to be more ${constraints.tone || 'appropriate'}.`,
		'add_details': 'Add relevant details to make the text more informative.',
		'simplify': 'Simplify the language to make it easier to understand.',
		'restructure': 'Reorganize the text for better flow and readability.',
	};

	return `You are optimizing content. Current output:\n\n"${currentOutput}"\n\nAction: ${action}\n${actionInstructions[action]}\n\nConstraints: ${JSON.stringify(constraints)}\n\nReturn the improved version.`;
}

function getDefaultSystemPrompt(useCase: string): string {
	const prompts: Record<string, string> = {
		'email': 'You are an expert email writer. Optimize emails to be clear and professional.',
		'code': 'You are an expert programmer. Optimize code for clarity and best practices.',
		'marketing': 'You are a marketing copywriter. Optimize copy to be engaging and persuasive.',
		'text-optimization': 'You are a text optimizer. Improve text based on the given constraints.',
		'default': 'You are a content optimizer. Improve the given text based on constraints.',
	};
	return prompts[useCase] || prompts['default'];
}
