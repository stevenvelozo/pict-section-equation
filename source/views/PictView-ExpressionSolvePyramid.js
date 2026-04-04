const libPictViewClass = require('pict-view');

const html = String.raw;

const default_configuration =
{
	"RenderOnLoad": true,
	"DefaultRenderable": "ExpressionSolvePyramid-Wrap",
	"DefaultDestinationAddress": "#ExpressionSolvePyramid-Container",

	"Templates": [
		{
			"Hash": "ExpressionSolvePyramid-Container",
			"Template": html`<div id="PictSectionEquation-ExpressionSolvePyramid" class="peq-sp"></div>`
		}
	],

	"Renderables": [
		{
			"RenderableHash": "ExpressionSolvePyramid-Wrap",
			"TemplateHash": "ExpressionSolvePyramid-Container",
			"DestinationAddress": "#ExpressionSolvePyramid-Container",
			"RenderType": "replace"
		}
	],

	"TargetElementAddress": "#ExpressionSolvePyramid-Container"
};

class PictViewExpressionSolvePyramid extends libPictViewClass
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, default_configuration, pOptions);
		super(pFable, tmpOptions, pServiceHash);

		this.solveResultObject = false;
		this.solveExpression = '';
	}

	escapeHTML(pString)
	{
		if (typeof(pString) !== 'string')
		{
			return String(pString);
		}
		return pString
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	/**
	 * Get the resolved value of a virtual symbol from the result object.
	 */
	getSymbolValue(pSymbolName, pResultObject)
	{
		if (!pResultObject || !pResultObject.VirtualSymbols)
		{
			return '';
		}
		if (pSymbolName in pResultObject.VirtualSymbols)
		{
			let tmpVal = pResultObject.VirtualSymbols[pSymbolName];
			if (typeof(tmpVal) === 'object' && !Array.isArray(tmpVal))
			{
				return `{${Object.keys(tmpVal).length} keys}`;
			}
			if (Array.isArray(tmpVal))
			{
				return `[${tmpVal.length} items]`;
			}
			return String(tmpVal);
		}
		return '';
	}

	/**
	 * Check if a token operand references a virtual symbol (prior solve step).
	 */
	getOperandVirtualSymbol(pToken)
	{
		if (!pToken)
		{
			return false;
		}
		if (pToken.Type === 'Token.VirtualSymbol' || pToken.Type === 'Token.Parenthesis')
		{
			// VirtualSymbolName may or may not be set; fall back to Token
			return pToken.VirtualSymbolName || pToken.Token || false;
		}
		return false;
	}

	/**
	 * Get a display label for a token operand.
	 */
	getOperandLabel(pToken)
	{
		if (!pToken)
		{
			return '';
		}
		return String(pToken.Token || '');
	}

	/**
	 * Get the resolved numeric value for a token operand.
	 */
	getOperandResolvedValue(pToken, pResultObject)
	{
		if (!pToken)
		{
			return '';
		}
		// If it references a virtual symbol, look up its value
		let tmpVSymName = this.getOperandVirtualSymbol(pToken);
		if (tmpVSymName)
		{
			return this.getSymbolValue(tmpVSymName, pResultObject);
		}
		// Otherwise use the token's own value
		if (pToken.Value !== undefined && pToken.Value !== null)
		{
			return String(pToken.Value);
		}
		return String(pToken.Token || '');
	}

	/**
	 * Build a dependency tree from PostfixSolveList.
	 * Returns a tree node for the root operation, with children for sub-operations.
	 *
	 * Tree node shape:
	 * {
	 *   symbolName: 'V_1',
	 *   operation: '+',
	 *   resolvedValue: '11',
	 *   leftLabel: '5', rightLabel: 'V_0',
	 *   leftResolved: '5', rightResolved: '6',
	 *   left: null | treeNode,
	 *   right: null | treeNode,
	 *   isFunction: false,
	 *   isAssignment: false,
	 *   leafSpan: 2  // number of leaf positions this subtree covers
	 * }
	 */
	buildDependencyTree(pResultObject)
	{
		if (!pResultObject || !pResultObject.PostfixSolveList || pResultObject.PostfixSolveList.length < 1)
		{
			return null;
		}

		let tmpSolveList = pResultObject.PostfixSolveList;

		// Build a map from VirtualSymbolName to solve list entry
		let tmpStepMap = {};
		for (let i = 0; i < tmpSolveList.length; i++)
		{
			let tmpStep = tmpSolveList[i];
			if (tmpStep.VirtualSymbolName)
			{
				tmpStepMap[tmpStep.VirtualSymbolName] = tmpStep;
			}
		}

		// Find the root: walk backward, skip assignment steps (=) to find the real computation
		let tmpRootStep = null;
		for (let i = tmpSolveList.length - 1; i >= 0; i--)
		{
			let tmpStep = tmpSolveList[i];
			let tmpOpToken = tmpStep.Operation ? tmpStep.Operation.Token : '';
			if (tmpOpToken !== '=')
			{
				tmpRootStep = tmpStep;
				break;
			}
		}
		// If all steps are assignments, fall back to the last one
		if (!tmpRootStep)
		{
			tmpRootStep = tmpSolveList[tmpSolveList.length - 1];
		}

		if (!tmpRootStep)
		{
			return null;
		}

		// Recursive tree builder
		let tmpSelf = this;
		function buildNode(pStep)
		{
			let tmpOpToken = pStep.Operation ? pStep.Operation.Token : '';
			let tmpIsFunction = (pStep.VirtualSymbolName && pStep.VirtualSymbolName.startsWith('VFE'));
			let tmpIsAssignment = (tmpOpToken === '=');

			let tmpNode =
			{
				symbolName: pStep.VirtualSymbolName || '',
				operation: tmpOpToken,
				resolvedValue: tmpSelf.getSymbolValue(pStep.VirtualSymbolName, pResultObject),
				leftLabel: tmpSelf.getOperandLabel(pStep.LeftValue),
				rightLabel: tmpSelf.getOperandLabel(pStep.RightValue),
				leftResolved: tmpSelf.getOperandResolvedValue(pStep.LeftValue, pResultObject),
				rightResolved: tmpSelf.getOperandResolvedValue(pStep.RightValue, pResultObject),
				left: null,
				right: null,
				isFunction: tmpIsFunction,
				isAssignment: tmpIsAssignment,
				leafSpan: 0,
				leftTokenType: pStep.LeftValue ? (pStep.LeftValue.Type || '') : '',
				rightTokenType: pStep.RightValue ? (pStep.RightValue.Type || '') : ''
			};

			// Check if left operand is a sub-operation
			let tmpLeftVSym = tmpSelf.getOperandVirtualSymbol(pStep.LeftValue);
			if (tmpLeftVSym && (tmpLeftVSym in tmpStepMap))
			{
				tmpNode.left = buildNode(tmpStepMap[tmpLeftVSym]);
			}

			// Check if right operand is a sub-operation
			let tmpRightVSym = tmpSelf.getOperandVirtualSymbol(pStep.RightValue);
			if (tmpRightVSym && (tmpRightVSym in tmpStepMap))
			{
				tmpNode.right = buildNode(tmpStepMap[tmpRightVSym]);
			}

			// Calculate leaf span (how many leaf columns this subtree covers)
			if (!tmpNode.left && !tmpNode.right)
			{
				// This node itself is a leaf operation (both operands are raw values)
				tmpNode.leafSpan = 1;
			}
			else
			{
				let tmpLeftSpan = tmpNode.left ? tmpNode.left.leafSpan : 1;
				let tmpRightSpan = tmpNode.right ? tmpNode.right.leafSpan : 1;
				tmpNode.leafSpan = tmpLeftSpan + tmpRightSpan;
			}

			return tmpNode;
		}

		return buildNode(tmpRootStep);
	}

	/**
	 * Get the depth (height) of the tree.
	 */
	getTreeDepth(pNode)
	{
		if (!pNode)
		{
			return 0;
		}
		let tmpLeftDepth = this.getTreeDepth(pNode.left);
		let tmpRightDepth = this.getTreeDepth(pNode.right);
		return 1 + Math.max(tmpLeftDepth, tmpRightDepth);
	}

	/**
	 * Collect all nodes at a specific depth level (0 = root).
	 * Returns array of { node, colspan } objects in left-to-right order.
	 */
	collectNodesAtLevel(pNode, pTargetLevel, pCurrentLevel)
	{
		if (!pNode)
		{
			return [];
		}

		if (pCurrentLevel === pTargetLevel)
		{
			return [{ node: pNode, colspan: pNode.leafSpan }];
		}

		// Not at target level yet — recurse into children
		let tmpResult = [];

		if (pNode.left)
		{
			let tmpLeftNodes = this.collectNodesAtLevel(pNode.left, pTargetLevel, pCurrentLevel + 1);
			tmpResult = tmpResult.concat(tmpLeftNodes);
		}
		else if (pCurrentLevel + 1 <= pTargetLevel)
		{
			// Left is a leaf value, need placeholder at deeper levels
			tmpResult.push({ node: null, colspan: 1, leafLabel: pNode.leftLabel, leafValue: pNode.leftResolved, leafTokenType: pNode.leftTokenType });
		}

		if (pNode.right)
		{
			let tmpRightNodes = this.collectNodesAtLevel(pNode.right, pTargetLevel, pCurrentLevel + 1);
			tmpResult = tmpResult.concat(tmpRightNodes);
		}
		else if (pCurrentLevel + 1 <= pTargetLevel && !pNode.isFunction)
		{
			// Right is a leaf value, need placeholder at deeper levels
			tmpResult.push({ node: null, colspan: 1, leafLabel: pNode.rightLabel, leafValue: pNode.rightResolved, leafTokenType: pNode.rightTokenType });
		}

		return tmpResult;
	}

	/**
	 * Build a description string for a node's operation.
	 */
	buildNodeExpression(pNode)
	{
		if (!pNode)
		{
			return '';
		}
		if (pNode.isFunction)
		{
			return `${this.escapeHTML(pNode.operation)}(${this.escapeHTML(pNode.leftLabel)})`;
		}
		if (pNode.isAssignment)
		{
			return `${this.escapeHTML(pNode.leftLabel)}`;
		}
		return `${this.escapeHTML(pNode.leftLabel)} ${this.escapeHTML(pNode.operation)} ${this.escapeHTML(pNode.rightLabel)}`;
	}

	/**
	 * Build a resolved description string for a node.
	 */
	buildNodeResolved(pNode)
	{
		if (!pNode)
		{
			return '';
		}
		if (pNode.isFunction)
		{
			return `${this.escapeHTML(pNode.operation)}(${this.escapeHTML(pNode.leftResolved)})`;
		}
		if (pNode.isAssignment)
		{
			return `${this.escapeHTML(pNode.leftResolved)}`;
		}
		return `${this.escapeHTML(pNode.leftResolved)} ${this.escapeHTML(pNode.operation)} ${this.escapeHTML(pNode.rightResolved)}`;
	}

	buildCSS()
	{
		return html`
		<style>
			.peq-sp
			{
				font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
				color: #1f2937;
				line-height: 1.5;
			}
			.peq-sp-title
			{
				font-size: 13px;
				font-weight: 600;
				text-transform: uppercase;
				letter-spacing: 0.05em;
				color: #475569;
				margin-bottom: 8px;
				padding-bottom: 4px;
				border-bottom: 2px solid #e2e8f0;
			}
			.peq-sp-expression
			{
				padding: 10px 14px;
				background: #f8fafc;
				border: 1px solid #e2e8f0;
				border-radius: 6px;
				font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
				font-size: 14px;
				font-weight: 600;
				color: #0f172a;
				margin-bottom: 16px;
			}
			.peq-sp-table
			{
				width: 100%;
				border-collapse: separate;
				border-spacing: 6px;
				margin-bottom: 16px;
			}
			.peq-sp-cell
			{
				text-align: center;
				vertical-align: middle;
				padding: 10px 12px;
				border-radius: 6px;
				border: 2px solid #e2e8f0;
				background: #f8fafc;
			}
			.peq-sp-cell-root
			{
				background: #eef2ff;
				border-color: #818cf8;
			}
			.peq-sp-cell-op
			{
				background: #f0fdf4;
				border-color: #86efac;
			}
			.peq-sp-cell-leaf
			{
				background: #f8fafc;
				border-color: #cbd5e1;
			}
			.peq-sp-cell-empty
			{
				border: none;
				background: none;
			}
			.peq-sp-sym
			{
				font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
				font-size: 11px;
				font-weight: 600;
				color: #7c3aed;
				margin-bottom: 2px;
			}
			.peq-sp-expr
			{
				font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
				font-size: 13px;
				font-weight: 600;
				color: #1e293b;
			}
			.peq-sp-resolved
			{
				font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
				font-size: 12px;
				color: #64748b;
				margin-top: 2px;
			}
			.peq-sp-value
			{
				font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
				font-size: 14px;
				font-weight: 700;
				color: #059669;
			}
			.peq-sp-leaf-label
			{
				font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
				font-size: 13px;
				font-weight: 600;
				color: #475569;
			}
			.peq-sp-leaf-value
			{
				font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
				font-size: 12px;
				color: #64748b;
			}
			.peq-sp-cell-var
			{
				background: #faf5ff;
				border-color: #c084fc;
			}
			.peq-sp-var-badge
			{
				display: inline-block;
				font-size: 9px;
				font-weight: 700;
				text-transform: uppercase;
				letter-spacing: 0.08em;
				color: #7c3aed;
				background: #ede9fe;
				border: 1px solid #c4b5fd;
				border-radius: 3px;
				padding: 1px 5px;
				margin-bottom: 3px;
			}
			.peq-sp-token-row
			{
				display: flex;
				flex-wrap: wrap;
				gap: 6px;
				margin-bottom: 16px;
			}
			.peq-sp-tok
			{
				text-align: center;
				padding: 6px 10px;
				border-radius: 5px;
				border: 1px solid #e2e8f0;
				min-width: 32px;
			}
			.peq-sp-tok-value
			{
				font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
				font-size: 13px;
				font-weight: 600;
			}
			.peq-sp-tok-type
			{
				font-size: 9px;
				font-weight: 600;
				text-transform: uppercase;
				letter-spacing: 0.05em;
				margin-top: 2px;
			}
			.peq-sp-tok-constant
			{
				background: #eff6ff;
				border-color: #93c5fd;
				color: #1d4ed8;
			}
			.peq-sp-tok-constant .peq-sp-tok-type
			{
				color: #60a5fa;
			}
			.peq-sp-tok-symbol
			{
				background: #faf5ff;
				border-color: #c084fc;
				color: #7c3aed;
			}
			.peq-sp-tok-symbol .peq-sp-tok-type
			{
				color: #a78bfa;
			}
			.peq-sp-tok-operator
			{
				background: #fff7ed;
				border-color: #fdba74;
				color: #c2410c;
			}
			.peq-sp-tok-operator .peq-sp-tok-type
			{
				color: #fb923c;
			}
			.peq-sp-tok-function
			{
				background: #f0fdf4;
				border-color: #86efac;
				color: #15803d;
			}
			.peq-sp-tok-function .peq-sp-tok-type
			{
				color: #4ade80;
			}
			.peq-sp-tok-virtual
			{
				background: #f1f5f9;
				border-color: #cbd5e1;
				color: #475569;
			}
			.peq-sp-tok-virtual .peq-sp-tok-type
			{
				color: #94a3b8;
			}
			.peq-sp-tok-other
			{
				background: #f8fafc;
				border-color: #e2e8f0;
				color: #64748b;
			}
			.peq-sp-tok-other .peq-sp-tok-type
			{
				color: #94a3b8;
			}
			.peq-sp-empty
			{
				text-align: center;
				padding: 24px 16px;
				color: #94a3b8;
				font-style: italic;
			}
		</style>`;
	}

	buildNodeCellHTML(pNode, pColspan, pIsRoot)
	{
		let tmpCellClass = pIsRoot ? 'peq-sp-cell peq-sp-cell-root' : 'peq-sp-cell peq-sp-cell-op';
		let tmpExpr = this.buildNodeExpression(pNode);
		let tmpResolved = this.buildNodeResolved(pNode);

		// If expression and resolved are the same (constants), skip resolved line
		let tmpResolvedHTML = '';
		if (tmpExpr !== tmpResolved)
		{
			tmpResolvedHTML = `<div class="peq-sp-resolved">${tmpResolved}</div>`;
		}

		return `<td colspan="${pColspan}" class="${tmpCellClass}">
			<div class="peq-sp-sym">${this.escapeHTML(pNode.symbolName)}</div>
			<div class="peq-sp-expr">${tmpExpr}</div>
			${tmpResolvedHTML}
			<div class="peq-sp-value">= ${this.escapeHTML(pNode.resolvedValue)}</div>
		</td>`;
	}

	isVariableToken(pLabel, pValue, pTokenType)
	{
		if (pTokenType === 'Token.Symbol')
		{
			return true;
		}
		// Heuristic: if label is different from value and label isn't numeric, it's a variable
		if (pLabel && pValue && pLabel !== pValue && isNaN(Number(pLabel)))
		{
			return true;
		}
		return false;
	}

	buildLeafCellHTML(pLabel, pValue, pColspan, pTokenType)
	{
		let tmpIsVariable = this.isVariableToken(pLabel, pValue, pTokenType);

		if (tmpIsVariable)
		{
			return `<td colspan="${pColspan}" class="peq-sp-cell peq-sp-cell-leaf peq-sp-cell-var">
				<div class="peq-sp-var-badge">var</div>
				<div class="peq-sp-leaf-label">${this.escapeHTML(pLabel)}</div>
				<div class="peq-sp-leaf-value">= ${this.escapeHTML(pValue)}</div>
			</td>`;
		}
		return `<td colspan="${pColspan}" class="peq-sp-cell peq-sp-cell-leaf">
			<div class="peq-sp-leaf-label">${this.escapeHTML(pLabel)}</div>
			<div class="peq-sp-leaf-value">${this.escapeHTML(pValue)}</div>
		</td>`;
	}

	buildPyramidHTML(pTree)
	{
		if (!pTree)
		{
			return '<div class="peq-sp-empty">No solve data to display</div>';
		}

		let tmpDepth = this.getTreeDepth(pTree);
		let tmpTotalCols = pTree.leafSpan;

		let tmpHTML = `<table class="peq-sp-table">`;

		// Render level by level, top (root) to bottom (leaves)
		for (let tmpLevel = 0; tmpLevel < tmpDepth; tmpLevel++)
		{
			let tmpNodes = this.collectNodesAtLevel(pTree, tmpLevel, 0);

			tmpHTML += '<tr>';
			for (let j = 0; j < tmpNodes.length; j++)
			{
				let tmpEntry = tmpNodes[j];
				if (tmpEntry.node)
				{
					tmpHTML += this.buildNodeCellHTML(tmpEntry.node, tmpEntry.colspan, tmpLevel === 0);
				}
				else
				{
					// Leaf placeholder — show the raw value
					tmpHTML += this.buildLeafCellHTML(
						tmpEntry.leafLabel || '',
						tmpEntry.leafValue || '',
						tmpEntry.colspan,
						tmpEntry.leafTokenType || ''
					);
				}
			}
			tmpHTML += '</tr>';
		}

		tmpHTML += '</table>';
		return tmpHTML;
	}

	getTokenCSSClass(pTokenType)
	{
		switch (pTokenType)
		{
			case 'Token.Constant':
				return 'peq-sp-tok-constant';
			case 'Token.Symbol':
				return 'peq-sp-tok-symbol';
			case 'Token.Operator':
				return 'peq-sp-tok-operator';
			case 'Token.Function':
				return 'peq-sp-tok-function';
			case 'Token.Parenthesis':
			case 'Token.VirtualSymbol':
				return 'peq-sp-tok-virtual';
			default:
				return 'peq-sp-tok-other';
		}
	}

	getTokenTypeLabel(pTokenType)
	{
		switch (pTokenType)
		{
			case 'Token.Constant':
				return 'const';
			case 'Token.Symbol':
				return 'var';
			case 'Token.Operator':
				return 'op';
			case 'Token.Function':
				return 'fn';
			case 'Token.Parenthesis':
			case 'Token.VirtualSymbol':
				return 'ref';
			default:
				return '';
		}
	}

	buildTokenSequenceHTML(pResultObject)
	{
		if (!pResultObject || !pResultObject.PostfixTokenObjects || pResultObject.PostfixTokenObjects.length < 1)
		{
			return '';
		}

		let tmpTokens = pResultObject.PostfixTokenObjects;
		let tmpHTML = '<div class="peq-sp-title">Token Sequence (Evaluation Order)</div>';
		tmpHTML += '<div class="peq-sp-token-row">';

		for (let i = 0; i < tmpTokens.length; i++)
		{
			let tmpToken = tmpTokens[i];
			let tmpTokenStr = tmpToken.Token || '';
			let tmpTokenType = tmpToken.Type || '';
			let tmpCSSClass = this.getTokenCSSClass(tmpTokenType);
			let tmpTypeLabel = this.getTokenTypeLabel(tmpTokenType);

			tmpHTML += `<div class="peq-sp-tok ${tmpCSSClass}">`;
			tmpHTML += `<div class="peq-sp-tok-value">${this.escapeHTML(tmpTokenStr)}</div>`;
			if (tmpTypeLabel)
			{
				tmpHTML += `<div class="peq-sp-tok-type">${tmpTypeLabel}</div>`;
			}
			tmpHTML += '</div>';
		}

		tmpHTML += '</div>';
		return tmpHTML;
	}

	buildVisualizationHTML()
	{
		let tmpResultObject = this.solveResultObject;

		if (!tmpResultObject)
		{
			return `${this.buildCSS()}<div class="peq-sp-empty">No expression data. Use setSolveResult() to provide data.</div>`;
		}

		let tmpExpression = ('RawExpression' in tmpResultObject) ? tmpResultObject.RawExpression : this.solveExpression;
		let tmpTree = this.buildDependencyTree(tmpResultObject);

		return `${this.buildCSS()}
		<div class="peq-sp-expression">${this.escapeHTML(tmpExpression)}</div>
		<div class="peq-sp-title">Solve Pyramid</div>
		${this.buildPyramidHTML(tmpTree)}
		${this.buildTokenSequenceHTML(tmpResultObject)}`;
	}

	setSolveResult(pResultObject, pExpression)
	{
		this.solveResultObject = (typeof(pResultObject) === 'object') ? pResultObject : false;
		this.solveExpression = (typeof(pExpression) === 'string') ? pExpression : '';
		this.renderVisualization();
	}

	renderVisualization()
	{
		let tmpContent = this.buildVisualizationHTML();
		this.services.ContentAssignment.assignContent('#PictSectionEquation-ExpressionSolvePyramid', tmpContent);
	}

	onAfterRender()
	{
		super.onAfterRender();
		if (this.solveResultObject)
		{
			this.renderVisualization();
		}
	}
}

module.exports = PictViewExpressionSolvePyramid;
module.exports.default_configuration = default_configuration;
