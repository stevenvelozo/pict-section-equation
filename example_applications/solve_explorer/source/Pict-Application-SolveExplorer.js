const libPictApplication = require('pict-application');
const libPictView = require('pict-view');

const libPictSectionEquation = require('pict-section-equation');

const html = String.raw;

const _PRESET_EXPRESSIONS =
[
	{ Label: 'Simple Math', Expression: '5 + 3 * 2', Data: '{}' },
	{ Label: 'Order of Ops', Expression: '(100 - 10) * (3 + 2)', Data: '{}' },
	{ Label: 'Assignment', Expression: 'Area = Width * Height', Data: '{"Width": 73.5, "Height": 28.8}' },
	{ Label: 'Square Root', Expression: 'sqrt(16) + 2 ^ 3', Data: '{}' },
	{ Label: 'Complex', Expression: 'Result = ((15000 * 2) / 4)^2 + 100 - 10 * (35 + 5)', Data: '{}' },
	{ Label: 'Trig', Expression: 'sin(rad(60)) + cos(rad(30))', Data: '{}' },
	{ Label: 'Variables', Expression: 'Result = (X + Y) * Z / 2', Data: '{"X": 12.5, "Y": 7.3, "Z": 4}' },
	{ Label: 'Rounding', Expression: 'ROUND(X * Y * Z, 2)', Data: '{"X": 5.867, "Y": 3.1, "Z": 75}' }
];

class SolveExplorerInputView extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
	}

	onAfterRender()
	{
		super.onAfterRender();

		let tmpPresetsHTML = '';
		for (let i = 0; i < _PRESET_EXPRESSIONS.length; i++)
		{
			tmpPresetsHTML += `<button class="peq-explorer-preset-btn" onclick="_Pict.views.SolveExplorerInput.loadPreset(${i})">${_PRESET_EXPRESSIONS[i].Label}</button>`;
		}

		let tmpInputHTML = html`
		<style>
			.peq-explorer-header
			{
				font-size: 24px;
				font-weight: 700;
				margin-bottom: 16px;
				color: #0f172a;
			}
			.peq-explorer-header-sub
			{
				font-size: 14px;
				font-weight: 400;
				color: #64748b;
			}
			.peq-explorer-input-panel
			{
				background: white;
				border: 1px solid #e2e8f0;
				border-radius: 8px;
				padding: 16px;
				margin-bottom: 20px;
			}
			.peq-explorer-input-row
			{
				display: flex;
				gap: 12px;
				margin-bottom: 12px;
			}
			.peq-explorer-expression-input
			{
				flex: 1;
				padding: 10px 14px;
				border: 2px solid #e2e8f0;
				border-radius: 6px;
				font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
				font-size: 14px;
				outline: none;
				transition: border-color 0.15s;
			}
			.peq-explorer-expression-input:focus
			{
				border-color: #6366f1;
			}
			.peq-explorer-solve-btn
			{
				padding: 10px 24px;
				background: #4f46e5;
				color: white;
				border: none;
				border-radius: 6px;
				font-size: 14px;
				font-weight: 600;
				cursor: pointer;
				transition: background 0.15s;
			}
			.peq-explorer-solve-btn:hover
			{
				background: #4338ca;
			}
			.peq-explorer-data-row
			{
				margin-bottom: 12px;
			}
			.peq-explorer-data-label
			{
				font-size: 12px;
				font-weight: 600;
				text-transform: uppercase;
				letter-spacing: 0.05em;
				color: #64748b;
				margin-bottom: 4px;
			}
			.peq-explorer-data-input
			{
				width: 100%;
				padding: 8px 12px;
				border: 1px solid #e2e8f0;
				border-radius: 6px;
				font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
				font-size: 13px;
				outline: none;
			}
			.peq-explorer-data-input:focus
			{
				border-color: #6366f1;
			}
			.peq-explorer-presets
			{
				display: flex;
				flex-wrap: wrap;
				gap: 8px;
			}
			.peq-explorer-presets-label
			{
				font-size: 12px;
				font-weight: 600;
				text-transform: uppercase;
				letter-spacing: 0.05em;
				color: #64748b;
				margin-bottom: 6px;
			}
			.peq-explorer-preset-btn
			{
				padding: 5px 12px;
				background: #f1f5f9;
				border: 1px solid #cbd5e1;
				border-radius: 4px;
				font-size: 12px;
				cursor: pointer;
				transition: background 0.15s;
			}
			.peq-explorer-preset-btn:hover
			{
				background: #e2e8f0;
			}
		</style>
		<div class="peq-explorer-header">
			Expression Solve Explorer
			<div class="peq-explorer-header-sub">Visualize the inner workings of the Fable Expression Parser</div>
		</div>
		<div class="peq-explorer-input-panel">
			<div class="peq-explorer-input-row">
				<input type="text" id="SolveExplorer-Expression-Input" class="peq-explorer-expression-input" placeholder="Enter an expression (e.g. 5 + 3 * 2)" value="5 + 3 * 2" />
				<button class="peq-explorer-solve-btn" onclick="_Pict.views.SolveExplorerInput.solveExpression()">Solve</button>
			</div>
			<div class="peq-explorer-data-row">
				<div class="peq-explorer-data-label">Variables (JSON)</div>
				<input type="text" id="SolveExplorer-Data-Input" class="peq-explorer-data-input" placeholder='{"X": 5, "Y": 10}' value="{}" />
			</div>
			<div class="peq-explorer-presets-label">Presets</div>
			<div class="peq-explorer-presets">
				${tmpPresetsHTML}
			</div>
		</div>`;

		this.services.ContentAssignment.assignContent('#SolveExplorer-Input-Container', tmpInputHTML);

		// Auto-solve the default expression
		this.solveExpression();
	}

	loadPreset(pIndex)
	{
		if (pIndex < 0 || pIndex >= _PRESET_EXPRESSIONS.length)
		{
			return;
		}
		let tmpPreset = _PRESET_EXPRESSIONS[pIndex];

		let tmpExpressionElements = this.services.ContentAssignment.getElement('#SolveExplorer-Expression-Input');
		let tmpDataElements = this.services.ContentAssignment.getElement('#SolveExplorer-Data-Input');

		if (tmpExpressionElements && tmpExpressionElements.length > 0)
		{
			tmpExpressionElements[0].value = tmpPreset.Expression;
		}
		if (tmpDataElements && tmpDataElements.length > 0)
		{
			tmpDataElements[0].value = tmpPreset.Data;
		}

		this.solveExpression();
	}

	solveExpression()
	{
		let tmpExpressionElements = this.services.ContentAssignment.getElement('#SolveExplorer-Expression-Input');
		let tmpDataElements = this.services.ContentAssignment.getElement('#SolveExplorer-Data-Input');

		if (!tmpExpressionElements || tmpExpressionElements.length < 1)
		{
			return;
		}

		let tmpExpression = tmpExpressionElements[0].value;
		if (!tmpExpression || tmpExpression.trim().length < 1)
		{
			return;
		}

		let tmpDataSource = {};
		if (tmpDataElements && tmpDataElements.length > 0)
		{
			try
			{
				tmpDataSource = JSON.parse(tmpDataElements[0].value);
			}
			catch(pError)
			{
				this.log.warn(`Could not parse data JSON: ${pError.message}`);
				tmpDataSource = {};
			}
		}

		// Instantiate the expression parser if needed
		this.fable.instantiateServiceProviderIfNotExists('ExpressionParser');

		let tmpResultObject = {};
		let tmpDestObject = {};
		let tmpResult = this.fable.ExpressionParser.solve(tmpExpression, tmpDataSource, tmpResultObject, false, tmpDestObject);

		// Pass the result to the visualizer views
		let tmpVisualizerView = this.pict.views.ExpressionSolveVisualizer;
		if (tmpVisualizerView)
		{
			tmpVisualizerView.setSolveResult(tmpResultObject, tmpExpression);
		}
		let tmpTokenStackView = this.pict.views.ExpressionTokenStackVisualizer;
		if (tmpTokenStackView)
		{
			tmpTokenStackView.setSolveResult(tmpResultObject, tmpExpression);
		}
		let tmpPyramidView = this.pict.views.ExpressionSolvePyramidVisualizer;
		if (tmpPyramidView)
		{
			tmpPyramidView.setSolveResult(tmpResultObject, tmpExpression);
		}
	}
}

const _SolveExplorerInputViewConfiguration =
{
	"ViewIdentifier": "SolveExplorerInput",
	"RenderOnLoad": true,
	"DefaultRenderable": "SolveExplorer-Input-Wrap",
	"DefaultDestinationAddress": "#SolveExplorer-Input-Container",

	"Templates": [
		{
			"Hash": "SolveExplorer-Input-Template",
			"Template": html`<div id="SolveExplorer-Input-Container"></div>`
		}
	],
	"Renderables": [
		{
			"RenderableHash": "SolveExplorer-Input-Wrap",
			"TemplateHash": "SolveExplorer-Input-Template",
			"DestinationAddress": "#SolveExplorer-Input-Container",
			"RenderType": "replace"
		}
	]
};

class SolveExplorerLayoutView extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
	}

	onAfterRender()
	{
		super.onAfterRender();

		// Render child views into the containers created by the layout template
		if (this.pict.views.SolveExplorerInput)
		{
			this.pict.views.SolveExplorerInput.render();
		}
		if (this.pict.views.ExpressionSolveVisualizer)
		{
			this.pict.views.ExpressionSolveVisualizer.render();
		}
		if (this.pict.views.ExpressionTokenStackVisualizer)
		{
			this.pict.views.ExpressionTokenStackVisualizer.render();
		}
		if (this.pict.views.ExpressionSolvePyramidVisualizer)
		{
			this.pict.views.ExpressionSolvePyramidVisualizer.render();
		}
	}
}

const _SolveExplorerLayoutViewConfiguration =
{
	"ViewIdentifier": "SolveExplorerLayout",
	"RenderOnLoad": true,
	"DefaultRenderable": "SolveExplorer-Layout-Wrap",
	"DefaultDestinationAddress": "#SolveExplorer-Container",

	"Templates": [
		{
			"Hash": "SolveExplorer-Layout-Template",
			"Template": html`
				<div id="SolveExplorer-Input-Container"></div>
				<div id="ExpressionSolve-Container"></div>
				<div id="ExpressionTokenStack-Container"></div>
				<div id="ExpressionSolvePyramid-Container"></div>
			`
		}
	],
	"Renderables": [
		{
			"RenderableHash": "SolveExplorer-Layout-Wrap",
			"TemplateHash": "SolveExplorer-Layout-Template",
			"DestinationAddress": "#SolveExplorer-Container",
			"RenderType": "replace"
		}
	]
};

class SolveExplorerApplication extends libPictApplication
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.pict.addView('SolveExplorerLayout', _SolveExplorerLayoutViewConfiguration, SolveExplorerLayoutView);
		this.pict.addView('SolveExplorerInput', _SolveExplorerInputViewConfiguration, SolveExplorerInputView);
		this.pict.addView('ExpressionSolveVisualizer',
			Object.assign({}, libPictSectionEquation.default_configuration,
			{
				"DefaultDestinationAddress": "#ExpressionSolve-Container"
			}),
			libPictSectionEquation);
		this.pict.addView('ExpressionTokenStackVisualizer',
			Object.assign({}, libPictSectionEquation.PictViewExpressionTokenStack.default_configuration,
			{
				"DefaultDestinationAddress": "#ExpressionTokenStack-Container"
			}),
			libPictSectionEquation.PictViewExpressionTokenStack);
		this.pict.addView('ExpressionSolvePyramidVisualizer',
			Object.assign({}, libPictSectionEquation.PictViewExpressionSolvePyramid.default_configuration,
			{
				"DefaultDestinationAddress": "#ExpressionSolvePyramid-Container"
			}),
			libPictSectionEquation.PictViewExpressionSolvePyramid);
	}
}

module.exports = SolveExplorerApplication;

module.exports.default_configuration =
{
	"Name": "Expression Solve Explorer",
	"Hash": "SolveExplorer",

	"MainViewportViewIdentifier": "SolveExplorerLayout",
	"MainViewportRenderableHash": "SolveExplorer-Layout-Wrap",
	"MainViewportDestinationAddress": "#SolveExplorer-Container",
	"AutoRenderMainViewportViewAfterInitialize": true,

	"pict_configuration":
	{
		"Product": "SolveExplorer"
	}
};
