import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

const PowersBrownyardCalculator = () => {
    const [wc, setWc] = useState(0.52);
    const [alpha, setAlpha] = useState(0.75);
    const [expPorosity, setExpPorosity] = useState(0.46);
    const [segPorosity, setSegPorosity] = useState(0.45);

    // Powers-Brownyard calculations
    const calculatePorosity = (wcRatio: number, hydration: number) => {
        const phiCap = (wcRatio - 0.36 * hydration) / (wcRatio + 0.32);
        const phiGel = 0.19 * hydration;
        const phiTotal = phiCap + phiGel;
        return {
            capillary: phiCap,
            gel: phiGel,
            total: phiTotal
        };
    };

    const currentCalc = calculatePorosity(wc, alpha);

    // Generate data for charts
    const alphaData = useMemo(() => {
        const data = [];
        for (let a = 0; a <= 1; a += 0.05) {
            const result = calculatePorosity(wc, a);
            data.push({
                alpha: a,
                capillary: result.capillary,
                gel: result.gel,
                total: result.total
            });
        }
        return data;
    }, [wc]);

    const wcData = useMemo(() => {
        const data = [];
        for (let w = 0.3; w <= 0.7; w += 0.02) {
            const result = calculatePorosity(w, alpha);
            data.push({
                wc: w,
                capillary: result.capillary,
                gel: result.gel,
                total: result.total
            });
        }
        return data;
    }, [alpha]);

    // Find best-fit alpha for experimental porosity
    const findBestAlpha = () => {
        let bestAlpha = 0;
        let minDiff = Infinity;
        for (let a = 0; a <= 1; a += 0.001) {
            const calc = calculatePorosity(wc, a);
            const diff = Math.abs(calc.total - expPorosity);
            if (diff < minDiff) {
                minDiff = diff;
                bestAlpha = a;
            }
        }
        return bestAlpha;
    };

    const bestFitAlpha = findBestAlpha();
    const bestFitCalc = calculatePorosity(wc, bestFitAlpha);

    // Typical hydration scenarios
    const scenarios = [
        { name: "High hydration (water cured)", alpha: 0.90, color: "#10b981" },
        { name: "Good sealed curing", alpha: 0.80, color: "#3b82f6" },
        { name: "Moderate sealed curing", alpha: 0.75, color: "#f59e0b" },
        { name: "Lower sealed curing", alpha: 0.70, color: "#ef4444" }
    ];

    const scenarioResults = scenarios.map(s => ({
        ...s,
        ...calculatePorosity(wc, s.alpha)
    }));

    return (
        <div className="w-full max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
            <h1 className="text-3xl font-bold mb-2 text-gray-800">Powers-Brownyard Porosity Calculator</h1>
            <p className="text-sm text-gray-600 mb-6">Interactive tool for cement paste porosity prediction and validation</p>

            {/* Input Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-white p-6 rounded-lg shadow">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">Material Parameters</h2>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Water-to-Cement Ratio (w/c): {wc.toFixed(2)}
                        </label>
                        <input
                            type="range"
                            min="0.30"
                            max="0.70"
                            step="0.01"
                            value={wc}
                            onChange={(e) => setWc(parseFloat(e.target.value))}
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>0.30</span>
                            <span>0.50</span>
                            <span>0.70</span>
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Degree of Hydration (α): {alpha.toFixed(2)}
                        </label>
                        <input
                            type="range"
                            min="0.50"
                            max="1.00"
                            step="0.01"
                            value={alpha}
                            onChange={(e) => setAlpha(parseFloat(e.target.value))}
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>0.50</span>
                            <span>0.75</span>
                            <span>1.00</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">Measured Values</h2>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Experimental Porosity (φ_exp): {expPorosity.toFixed(3)}
                        </label>
                        <input
                            type="range"
                            min="0.20"
                            max="0.60"
                            step="0.01"
                            value={expPorosity}
                            onChange={(e) => setExpPorosity(parseFloat(e.target.value))}
                            className="w-full"
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Segmented Porosity (φ_seg): {segPorosity.toFixed(3)}
                        </label>
                        <input
                            type="range"
                            min="0.20"
                            max="0.60"
                            step="0.01"
                            value={segPorosity}
                            onChange={(e) => setSegPorosity(parseFloat(e.target.value))}
                            className="w-full"
                        />
                    </div>
                </div>
            </div>

            {/* Current Calculation Results */}
            <div className="bg-white p-6 rounded-lg shadow mb-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">Powers-Brownyard Predictions</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-4 rounded">
                        <div className="text-sm text-gray-600">Capillary Porosity</div>
                        <div className="text-2xl font-bold text-blue-700">φ_cap = {currentCalc.capillary.toFixed(3)}</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded">
                        <div className="text-sm text-gray-600">Gel Porosity</div>
                        <div className="text-2xl font-bold text-green-700">φ_gel = {currentCalc.gel.toFixed(3)}</div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded">
                        <div className="text-sm text-gray-600">Total Porosity</div>
                        <div className="text-2xl font-bold text-purple-700">φ_total = {currentCalc.total.toFixed(3)}</div>
                    </div>
                </div>
            </div>

            {/* Best Fit Analysis */}
            <div className="bg-gradient-to-r from-orange-50 to-red-50 p-6 rounded-lg shadow mb-6 border-2 border-orange-200">
                <h2 className="text-xl font-semibold mb-3 text-gray-800">Best-Fit Analysis</h2>
                <p className="text-sm text-gray-700 mb-3">
                    To match experimental porosity φ_exp = {expPorosity.toFixed(3)} at w/c = {wc.toFixed(2)}:
                </p>
                <div className="bg-white p-4 rounded-lg">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div>
                            <div className="text-xs text-gray-500">Required α</div>
                            <div className="text-xl font-bold text-orange-600">{bestFitAlpha.toFixed(3)}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500">Predicted φ_cap</div>
                            <div className="text-lg font-semibold text-blue-600">{bestFitCalc.capillary.toFixed(3)}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500">Predicted φ_gel</div>
                            <div className="text-lg font-semibold text-green-600">{bestFitCalc.gel.toFixed(3)}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500">Error</div>
                            <div className="text-lg font-semibold text-red-600">
                                {Math.abs(bestFitCalc.total - expPorosity).toFixed(4)}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="mt-3 text-sm text-gray-600">
                    <strong>Interpretation:</strong> {bestFitAlpha > 0.85 ?
                        "High hydration typical of water curing or excellent sealed conditions." :
                        bestFitAlpha > 0.75 ?
                            "Moderate hydration consistent with sealed curing at 90 days." :
                            "Lower hydration suggesting limited water availability or shorter curing time."}
                </div>
            </div>

            {/* Scenario Comparison */}
            <div className="bg-white p-6 rounded-lg shadow mb-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">Typical Curing Scenarios (w/c = {wc.toFixed(2)})</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="p-2 text-left">Scenario</th>
                                <th className="p-2 text-center">α</th>
                                <th className="p-2 text-center">φ_cap</th>
                                <th className="p-2 text-center">φ_gel</th>
                                <th className="p-2 text-center">φ_total</th>
                                <th className="p-2 text-center">vs. Exp</th>
                            </tr>
                        </thead>
                        <tbody>
                            {scenarioResults.map((s, i) => (
                                <tr key={i} className="border-b hover:bg-gray-50">
                                    <td className="p-2">
                                        <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: s.color }}></span>
                                        {s.name}
                                    </td>
                                    <td className="p-2 text-center font-mono">{s.alpha.toFixed(2)}</td>
                                    <td className="p-2 text-center font-mono">{s.capillary.toFixed(3)}</td>
                                    <td className="p-2 text-center font-mono">{s.gel.toFixed(3)}</td>
                                    <td className="p-2 text-center font-mono font-bold">{s.total.toFixed(3)}</td>
                                    <td className="p-2 text-center">
                                        <span className={`font-semibold ${Math.abs(s.total - expPorosity) < 0.02 ? 'text-green-600' : 'text-gray-400'}`}>
                                            {(s.total - expPorosity > 0 ? '-' : '+')}{Math.abs(s.total - expPorosity).toFixed(3)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            <tr className="bg-orange-50 font-semibold">
                                <td className="p-2">Your experimental value</td>
                                <td className="p-2 text-center">-</td>
                                <td className="p-2 text-center">-</td>
                                <td className="p-2 text-center">-</td>
                                <td className="p-2 text-center font-mono">{expPorosity.toFixed(3)}</td>
                                <td className="p-2 text-center text-orange-600">reference</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-semibold mb-3 text-gray-700">Porosity vs Degree of Hydration</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={alphaData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="alpha"
                                label={{ value: 'Degree of Hydration (α)', position: 'insideBottom', offset: -5 }}
                                domain={[0, 1]}
                            />
                            <YAxis
                                label={{ value: 'Porosity', angle: -90, position: 'insideLeft' }}
                                domain={[0, 0.6]}
                            />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="total" stroke="#8b5cf6" strokeWidth={2} name="Total" />
                            <Line type="monotone" dataKey="capillary" stroke="#3b82f6" strokeWidth={2} name="Capillary" />
                            <Line type="monotone" dataKey="gel" stroke="#10b981" strokeWidth={2} name="Gel" />
                            <ReferenceLine y={expPorosity} stroke="#f59e0b" strokeDasharray="5 5" label="Exp" />
                            <ReferenceLine y={segPorosity} stroke="#ef4444" strokeDasharray="5 5" label="Seg" />
                            <ReferenceLine x={alpha} stroke="#6b7280" strokeDasharray="3 3" />
                        </LineChart>
                    </ResponsiveContainer>
                    <p className="text-xs text-gray-500 mt-2">
                        Orange dashed line: experimental porosity. Red dashed line: segmented porosity. Gray vertical: current α.
                    </p>
                </div>

                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-semibold mb-3 text-gray-700">Porosity vs Water-Cement Ratio</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={wcData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="wc"
                                label={{ value: 'Water-Cement Ratio (w/c)', position: 'insideBottom', offset: -5 }}
                                domain={[0.3, 0.7]}
                            />
                            <YAxis
                                label={{ value: 'Porosity', angle: -90, position: 'insideLeft' }}
                                domain={[0, 0.6]}
                            />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="total" stroke="#8b5cf6" strokeWidth={2} name="Total" />
                            <Line type="monotone" dataKey="capillary" stroke="#3b82f6" strokeWidth={2} name="Capillary" />
                            <Line type="monotone" dataKey="gel" stroke="#10b981" strokeWidth={2} name="Gel" />
                            <ReferenceLine y={expPorosity} stroke="#f59e0b" strokeDasharray="5 5" label="Exp" />
                            <ReferenceLine y={segPorosity} stroke="#ef4444" strokeDasharray="5 5" label="Seg" />
                            <ReferenceLine x={wc} stroke="#6b7280" strokeDasharray="3 3" />
                        </LineChart>
                    </ResponsiveContainer>
                    <p className="text-xs text-gray-500 mt-2">
                        Orange dashed line: experimental porosity. Red dashed line: segmented porosity. Gray vertical: current w/c.
                    </p>
                </div>
            </div>

            {/* Formulas */}
            <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">Powers-Brownyard Equations</h2>
                <div className="space-y-3 font-mono text-sm bg-gray-50 p-4 rounded">
                    <div>φ_capillary = (w/c - 0.36α) / (w/c + 0.32)</div>
                    <div>φ_gel = 0.19α</div>
                    <div>φ_total = φ_capillary + φ_gel</div>
                </div>
                <div className="mt-4 text-sm text-gray-600 space-y-2">
                    <p><strong>Where:</strong></p>
                    <ul className="list-disc list-inside ml-4">
                        <li><strong>w/c</strong> = water-to-cement ratio by mass</li>
                        <li><strong>α</strong> = degree of hydration (0 to 1)</li>
                        <li><strong>φ_capillary</strong> = capillary porosity (pores &gt; ~10 nm)</li>
                        <li><strong>φ_gel</strong> = gel porosity in C-S-H (&lt; 10 nm)</li>
                    </ul>
                    <p className="mt-3"><strong>Note:</strong> These equations assume complete reaction of all cement. In practice, sealed curing typically achieves α = 0.70-0.85, while water curing can reach α = 0.85-0.95.</p>
                </div>
            </div>

            {/* Export Results */}
            <div className="bg-blue-50 p-6 rounded-lg shadow mt-6">
                <h2 className="text-lg font-semibold mb-3 text-gray-700">Results Summary for Manuscript</h2>
                <div className="bg-white p-4 rounded font-mono text-xs overflow-x-auto">
                    <pre>{`Powers-Brownyard Prediction for w/c = ${wc.toFixed(2)}, α = ${alpha.toFixed(2)}:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Capillary porosity:  φ_cap   = ${currentCalc.capillary.toFixed(3)}
Gel porosity:        φ_gel   = ${currentCalc.gel.toFixed(3)}
Total porosity:      φ_total = ${currentCalc.total.toFixed(3)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Experimental measurements:
Gravimetric porosity:     ${expPorosity.toFixed(3)}
Image-segmented porosity: ${segPorosity.toFixed(3)}

Difference (measured - predicted):
Experimental vs total:  ${(expPorosity - currentCalc.total >= 0 ? '+' : '')}${(expPorosity - currentCalc.total).toFixed(3)} (${((expPorosity - currentCalc.total) / currentCalc.total * 100).toFixed(1)}%)
Segmented vs capillary: ${(segPorosity - currentCalc.capillary >= 0 ? '+' : '')}${(segPorosity - currentCalc.capillary).toFixed(3)} (${((segPorosity - currentCalc.capillary) / currentCalc.capillary * 100).toFixed(1)}%)

Best-fit hydration degree: α = ${bestFitAlpha.toFixed(3)} → φ_total = ${bestFitCalc.total.toFixed(3)}
`}</pre>
                </div>
            </div>
        </div>
    );
};

export default PowersBrownyardCalculator;
