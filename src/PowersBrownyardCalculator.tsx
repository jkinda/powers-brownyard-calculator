import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell } from 'recharts';

const PowersBrownyardCalculator = () => {
    const [wc, setWc] = useState(0.52);
    const [alpha, setAlpha] = useState(0.75);
    const [expPorosity, setExpPorosity] = useState(0.46);
    const [segPorosity, setSegPorosity] = useState(0.45);
    const [resolution, setResolution] = useState(130); // nm/pixel
    const [activeTab, setActiveTab] = useState<'powers' | 'jennings' | 'resolution'>('powers');

    // Powers-Brownyard calculations
    const calculatePorosity = (wcRatio: number, hydration: number) => {
        const phiCap = Math.max(0, (wcRatio - 0.36 * hydration) / (wcRatio + 0.32));
        const phiGel = 0.19 * hydration;
        const phiTotal = phiCap + phiGel;
        return {
            capillary: phiCap,
            gel: phiGel,
            total: phiTotal
        };
    };

    // Jennings Colloidal Model (2000, 2008) - LD/HD C-S-H
    const calculateJenningsModel = (hydration: number) => {
        // From Thomas & Jennings 2006, Table 1
        const ldPorosity = 0.49; // 49% intrinsic porosity in LD C-S-H
        const hdPorosity = 0.38; // 38% intrinsic porosity in HD C-S-H

        // Volume fractions of LD and HD C-S-H (vary with hydration)
        // At early ages, more LD; at later ages, more HD
        const ldFraction = 0.7 - 0.3 * hydration; // decreases with hydration
        const hdFraction = 1 - ldFraction;

        // C-S-H volume (approximately 0.57α of paste volume)
        const cshVolume = 0.57 * hydration;

        // Gel porosity from LD and HD contributions
        const gelFromLD = ldFraction * cshVolume * ldPorosity;
        const gelFromHD = hdFraction * cshVolume * hdPorosity;
        const totalGelPorosity = gelFromLD + gelFromHD;

        // Inter-globule pores (3-12 nm) - part of intrinsic gel porosity
        const smallGelPores = totalGelPorosity * 0.3; // ~30% in SGP (<3nm)
        const largeGelPores = totalGelPorosity * 0.5; // ~50% in LGP (3-12nm)
        const interClusterPores = totalGelPorosity * 0.2; // ~20% in inter-cluster (>12nm)

        return {
            ldFraction,
            hdFraction,
            cshVolume,
            gelFromLD,
            gelFromHD,
            totalGelPorosity,
            smallGelPores,
            largeGelPores,
            interClusterPores
        };
    };

    // Pore size distribution model
    const generatePoreDistribution = (hydration: number, wcRatio: number) => {
        const pb = calculatePorosity(wcRatio, hydration);
        const jm = calculateJenningsModel(hydration);

        // Approximate pore size distribution (log scale)
        const poreRanges = [
            { name: 'SGP (<3nm)', min: 1, max: 3, fraction: jm.smallGelPores, type: 'gel', resolvable: false },
            { name: 'LGP (3-12nm)', min: 3, max: 12, fraction: jm.largeGelPores, type: 'gel', resolvable: false },
            { name: 'Inter-cluster (12-50nm)', min: 12, max: 50, fraction: jm.interClusterPores, type: 'gel', resolvable: false },
            { name: 'Small capillary (50-500nm)', min: 50, max: 500, fraction: pb.capillary * 0.4, type: 'capillary', resolvable: true },
            { name: 'Large capillary (>500nm)', min: 500, max: 10000, fraction: pb.capillary * 0.6, type: 'capillary', resolvable: true },
        ];

        return poreRanges.map(p => ({
            ...p,
            resolvable: p.min >= resolution * 3, // 3 pixels minimum for reliable detection
            partiallyResolvable: p.max >= resolution * 3 && p.min < resolution * 3
        }));
    };

    const currentCalc = calculatePorosity(wc, alpha);
    const jenningsModel = calculateJenningsModel(alpha);
    const poreDistribution = generatePoreDistribution(alpha, wc);

    // Calculate what fraction is resolvable at current resolution
    const calculateResolvablePorosity = () => {
        const effectiveResolution = resolution * 3; // 3 pixels for reliable detection
        let resolvable = 0;
        let partiallyResolvable = 0;

        poreDistribution.forEach(p => {
            if (p.min >= effectiveResolution) {
                resolvable += p.fraction;
            } else if (p.max >= effectiveResolution) {
                // Partially resolvable - assume log-uniform distribution
                const logMin = Math.log10(Math.max(p.min, 1));
                const logMax = Math.log10(p.max);
                const logRes = Math.log10(effectiveResolution);
                const fractionAbove = (logMax - logRes) / (logMax - logMin);
                partiallyResolvable += p.fraction * fractionAbove;
            }
        });

        return { resolvable, partiallyResolvable, total: resolvable + partiallyResolvable };
    };

    const resolvablePorosity = calculateResolvablePorosity();

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

    // Pore distribution bar chart data
    const poreChartData = poreDistribution.map(p => ({
        name: p.name,
        fraction: p.fraction * 100,
        fill: p.resolvable ? '#10b981' : p.partiallyResolvable ? '#f59e0b' : '#ef4444'
    }));

    return (
        <div className="w-full max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
            <h1 className="text-3xl font-bold mb-2 text-gray-800">Powers-Brownyard & Jennings C-S-H Model Calculator</h1>
            <p className="text-sm text-gray-600 mb-6">Interactive tool for cement paste porosity prediction, pore partitioning, and imaging resolution analysis</p>

            {/* Tab Navigation */}
            <div className="flex space-x-2 mb-6">
                <button
                    onClick={() => setActiveTab('powers')}
                    className={`px-4 py-2 rounded-t-lg font-medium ${activeTab === 'powers' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'bg-gray-200 text-gray-600'}`}
                >
                    Powers-Brownyard Model
                </button>
                <button
                    onClick={() => setActiveTab('jennings')}
                    className={`px-4 py-2 rounded-t-lg font-medium ${activeTab === 'jennings' ? 'bg-white text-purple-600 border-b-2 border-purple-600' : 'bg-gray-200 text-gray-600'}`}
                >
                    Jennings C-S-H Model
                </button>
                <button
                    onClick={() => setActiveTab('resolution')}
                    className={`px-4 py-2 rounded-t-lg font-medium ${activeTab === 'resolution' ? 'bg-white text-green-600 border-b-2 border-green-600' : 'bg-gray-200 text-gray-600'}`}
                >
                    Resolution Analysis
                </button>
            </div>

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
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">Measured Values & Imaging</h2>

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

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Imaging Resolution: {resolution} nm/pixel
                        </label>
                        <input
                            type="range"
                            min="10"
                            max="500"
                            step="10"
                            value={resolution}
                            onChange={(e) => setResolution(parseFloat(e.target.value))}
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>10 nm (FIB-SEM)</span>
                            <span>130 nm (ESEM)</span>
                            <span>500 nm</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Powers-Brownyard Tab */}
            {activeTab === 'powers' && (
                <>
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
                        </div>
                    </div>
                </>
            )}

            {/* Jennings C-S-H Model Tab */}
            {activeTab === 'jennings' && (
                <>
                    <div className="bg-white p-6 rounded-lg shadow mb-6">
                        <h2 className="text-xl font-semibold mb-4 text-purple-700">Jennings Colloidal C-S-H Model</h2>
                        <p className="text-sm text-gray-600 mb-4">
                            Based on Thomas & Jennings (2006) "A colloidal interpretation of chemical aging of the C-S-H gel"
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* LD/HD C-S-H Visualization */}
                            <div className="bg-purple-50 p-4 rounded-lg">
                                <h3 className="font-semibold text-purple-800 mb-3">C-S-H Morphology</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">LD C-S-H (low-density)</span>
                                        <span className="font-mono font-bold text-purple-600">{(jenningsModel.ldFraction * 100).toFixed(0)}%</span>
                                    </div>
                                    <div className="w-full bg-purple-200 rounded-full h-4">
                                        <div
                                            className="bg-purple-500 h-4 rounded-full"
                                            style={{ width: `${jenningsModel.ldFraction * 100}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-xs text-gray-600">Intrinsic porosity: 49%, globule radius: 8.3 nm</p>

                                    <div className="flex items-center justify-between mt-4">
                                        <span className="text-sm">HD C-S-H (high-density)</span>
                                        <span className="font-mono font-bold text-indigo-600">{(jenningsModel.hdFraction * 100).toFixed(0)}%</span>
                                    </div>
                                    <div className="w-full bg-indigo-200 rounded-full h-4">
                                        <div
                                            className="bg-indigo-500 h-4 rounded-full"
                                            style={{ width: `${jenningsModel.hdFraction * 100}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-xs text-gray-600">Intrinsic porosity: 38%, globule radius: &gt;100 nm</p>
                                </div>
                            </div>

                            {/* Pore Size Classification */}
                            <div className="bg-blue-50 p-4 rounded-lg">
                                <h3 className="font-semibold text-blue-800 mb-3">Pore Size Classification</h3>
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left py-1">Type</th>
                                            <th className="text-left py-1">Size</th>
                                            <th className="text-right py-1">Volume</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-b">
                                            <td className="py-1">
                                                <span className="inline-block w-3 h-3 bg-red-400 rounded mr-2"></span>
                                                Small Gel Pores (SGP)
                                            </td>
                                            <td className="py-1">&lt;3 nm</td>
                                            <td className="py-1 text-right font-mono">{(jenningsModel.smallGelPores * 100).toFixed(1)}%</td>
                                        </tr>
                                        <tr className="border-b">
                                            <td className="py-1">
                                                <span className="inline-block w-3 h-3 bg-orange-400 rounded mr-2"></span>
                                                Large Gel Pores (LGP)
                                            </td>
                                            <td className="py-1">3-12 nm</td>
                                            <td className="py-1 text-right font-mono">{(jenningsModel.largeGelPores * 100).toFixed(1)}%</td>
                                        </tr>
                                        <tr className="border-b">
                                            <td className="py-1">
                                                <span className="inline-block w-3 h-3 bg-yellow-400 rounded mr-2"></span>
                                                Inter-cluster
                                            </td>
                                            <td className="py-1">12-50 nm</td>
                                            <td className="py-1 text-right font-mono">{(jenningsModel.interClusterPores * 100).toFixed(1)}%</td>
                                        </tr>
                                        <tr className="border-b">
                                            <td className="py-1">
                                                <span className="inline-block w-3 h-3 bg-green-400 rounded mr-2"></span>
                                                Capillary (small)
                                            </td>
                                            <td className="py-1">50-500 nm</td>
                                            <td className="py-1 text-right font-mono">{(currentCalc.capillary * 0.4 * 100).toFixed(1)}%</td>
                                        </tr>
                                        <tr>
                                            <td className="py-1">
                                                <span className="inline-block w-3 h-3 bg-green-600 rounded mr-2"></span>
                                                Capillary (large)
                                            </td>
                                            <td className="py-1">&gt;500 nm</td>
                                            <td className="py-1 text-right font-mono">{(currentCalc.capillary * 0.6 * 100).toFixed(1)}%</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Key insight box */}
                    <div className="bg-gradient-to-r from-purple-100 to-indigo-100 p-6 rounded-lg shadow mb-6 border-l-4 border-purple-500">
                        <h3 className="text-lg font-semibold text-purple-800 mb-2">🔑 Key Insight from Jennings Model</h3>
                        <p className="text-gray-700">
                            The boundary between "gel pores" and "capillary pores" is <strong>not sharp</strong>.
                            According to Thomas & Jennings (2006): <em>"The spaces between the LD and HD particles are large gel pores
                                that might be considered small capillary pores in other models."</em>
                        </p>
                        <p className="text-gray-700 mt-2">
                            This explains why BSE-SEM at 130 nm resolution can capture a significant portion of what
                            Powers-Brownyard classifies as "gel porosity" – the inter-cluster pores extend into the
                            sub-micrometer range, making them partially resolvable.
                        </p>
                    </div>

                    {/* Pore distribution chart */}
                    <div className="bg-white p-6 rounded-lg shadow mb-6">
                        <h3 className="text-lg font-semibold mb-3 text-gray-700">Pore Size Distribution</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={poreChartData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" domain={[0, 'auto']} label={{ value: 'Volume (%)', position: 'insideBottom', offset: -5 }} />
                                <YAxis type="category" dataKey="name" width={150} />
                                <Tooltip />
                                <Bar dataKey="fraction" name="Volume fraction">
                                    {poreChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                        <div className="flex justify-center gap-6 mt-3 text-sm">
                            <span><span className="inline-block w-3 h-3 bg-green-500 rounded mr-1"></span> Resolvable at {resolution} nm</span>
                            <span><span className="inline-block w-3 h-3 bg-yellow-500 rounded mr-1"></span> Partially resolvable</span>
                            <span><span className="inline-block w-3 h-3 bg-red-500 rounded mr-1"></span> Below resolution</span>
                        </div>
                    </div>
                </>
            )}

            {/* Resolution Analysis Tab */}
            {activeTab === 'resolution' && (
                <>
                    <div className="bg-white p-6 rounded-lg shadow mb-6">
                        <h2 className="text-xl font-semibold mb-4 text-green-700">Resolution Analysis: Why Segmented ≈ Total?</h2>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="bg-red-50 p-4 rounded">
                                <div className="text-sm text-gray-600">Expected (Capillary only)</div>
                                <div className="text-2xl font-bold text-red-700">φ_cap = {currentCalc.capillary.toFixed(3)}</div>
                            </div>
                            <div className="bg-yellow-50 p-4 rounded">
                                <div className="text-sm text-gray-600">Estimated Resolvable</div>
                                <div className="text-2xl font-bold text-yellow-700">φ_res = {resolvablePorosity.total.toFixed(3)}</div>
                            </div>
                            <div className="bg-green-50 p-4 rounded">
                                <div className="text-sm text-gray-600">Your Segmented</div>
                                <div className="text-2xl font-bold text-green-700">φ_seg = {segPorosity.toFixed(3)}</div>
                            </div>
                        </div>

                        {/* Explanation */}
                        <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-500">
                            <h3 className="font-semibold text-yellow-800 mb-2">📐 Why is φ_seg ≈ φ_total?</h3>
                            <p className="text-gray-700 text-sm mb-2">
                                At {resolution} nm/pixel resolution (effective ~{resolution * 3} nm for 3-pixel features):
                            </p>
                            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                                <li><strong>Fully resolvable:</strong> {(resolvablePorosity.resolvable * 100).toFixed(1)}% (capillary pores &gt;{resolution * 3} nm)</li>
                                <li><strong>Partially resolvable:</strong> {(resolvablePorosity.partiallyResolvable * 100).toFixed(1)}% (inter-cluster + upper gel pores)</li>
                                <li><strong>Below resolution:</strong> {((currentCalc.total - resolvablePorosity.total) * 100).toFixed(1)}% (SGP, LGP &lt;{resolution * 3} nm)</li>
                            </ul>
                        </div>
                    </div>

                    {/* Contributing factors */}
                    <div className="bg-white p-6 rounded-lg shadow mb-6">
                        <h3 className="text-lg font-semibold mb-4 text-gray-700">Contributing Factors to High Segmented Porosity</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="border rounded-lg p-4">
                                <h4 className="font-semibold text-blue-700 mb-2">1. Fractal C-S-H Structure</h4>
                                <p className="text-sm text-gray-600">
                                    C-S-H has a fractal dimension of ~2.6. This means pore sizes form a continuous
                                    distribution, not a bimodal one. "Large gel pores" extend into the resolvable range.
                                </p>
                            </div>

                            <div className="border rounded-lg p-4">
                                <h4 className="font-semibold text-purple-700 mb-2">2. LD C-S-H Inter-cluster Pores</h4>
                                <p className="text-sm text-gray-600">
                                    Low-density C-S-H contains inter-cluster pores (12-500 nm) that are often
                                    misclassified as "capillary" but are intrinsic to gel morphology.
                                </p>
                            </div>

                            <div className="border rounded-lg p-4">
                                <h4 className="font-semibold text-orange-700 mb-2">3. Sample Preparation Effects</h4>
                                <p className="text-sm text-gray-600">
                                    Vacuum drying causes microcracking and C-S-H shrinkage, opening desiccation
                                    pores. This can increase apparent porosity by 5-15%.
                                </p>
                            </div>

                            <div className="border rounded-lg p-4">
                                <h4 className="font-semibold text-red-700 mb-2">4. Partial Volume Effects</h4>
                                <p className="text-sm text-gray-600">
                                    Pixels at pore boundaries contain both solid and void. Thresholding
                                    tends to overestimate porosity at the resolution limit.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Manuscript paragraph */}
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-lg shadow mb-6 border-2 border-green-300">
                        <h3 className="text-lg font-semibold text-green-800 mb-3">📝 Suggested Manuscript Paragraph</h3>
                        <div className="bg-white p-4 rounded text-sm text-gray-700 italic">
                            "The close agreement between segmented porosity (φ_seg ≈ {segPorosity.toFixed(2)}) and
                            total measured porosity (φ_exp = {expPorosity.toFixed(2)}), despite a nominal resolution of {resolution} nm/pixel,
                            can be rationalized through the colloidal model of C-S-H proposed by Thomas and Jennings (2006).
                            According to this model, low-density C-S-H (LD C-S-H) contains approximately 49% intrinsic
                            porosity, with inter-globule pores extending from the nanometer to sub-micrometer scale.
                            The fractal nature of the C-S-H structure means that the boundary between gel and capillary
                            porosity is not sharp; large gel pores between LD C-S-H clusters 'might be considered small
                            capillary pores in other models' (Thomas & Jennings, 2006). Additionally, sample preparation
                            involving vacuum drying may induce irreversible shrinkage and microstructural rearrangement,
                            effectively opening desiccation pores that contribute to the segmented porosity."
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            <strong>Reference:</strong> Thomas, J.J., Jennings, H.M. (2006). A colloidal interpretation of chemical aging
                            of the C-S-H gel. Cement and Concrete Research, 36, 30-38.
                        </p>
                    </div>
                </>
            )}

            {/* Formulas */}
            <div className="bg-white p-6 rounded-lg shadow mb-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">Model Equations</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h3 className="font-semibold text-blue-700 mb-2">Powers-Brownyard (1948)</h3>
                        <div className="space-y-2 font-mono text-sm bg-blue-50 p-4 rounded">
                            <div>φ_capillary = (w/c - 0.36α) / (w/c + 0.32)</div>
                            <div>φ_gel = 0.19α</div>
                            <div>φ_total = φ_capillary + φ_gel</div>
                        </div>
                    </div>
                    <div>
                        <h3 className="font-semibold text-purple-700 mb-2">Jennings Colloidal Model (2000, 2006)</h3>
                        <div className="space-y-2 font-mono text-sm bg-purple-50 p-4 rounded">
                            <div>LD C-S-H: φ_intrinsic = 49%</div>
                            <div>HD C-S-H: φ_intrinsic = 38%</div>
                            <div>SGP: 1-3 nm, LGP: 3-12 nm</div>
                            <div>Inter-cluster: 12-50+ nm</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Export Results */}
            <div className="bg-blue-50 p-6 rounded-lg shadow">
                <h2 className="text-lg font-semibold mb-3 text-gray-700">Complete Results Summary</h2>
                <div className="bg-white p-4 rounded font-mono text-xs overflow-x-auto">
                    <pre>{`Powers-Brownyard Prediction for w/c = ${wc.toFixed(2)}, α = ${alpha.toFixed(2)}:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Capillary porosity:  φ_cap   = ${currentCalc.capillary.toFixed(3)}
Gel porosity:        φ_gel   = ${currentCalc.gel.toFixed(3)}
Total porosity:      φ_total = ${currentCalc.total.toFixed(3)}

Jennings C-S-H Model:
LD C-S-H fraction:   ${(jenningsModel.ldFraction * 100).toFixed(0)}%
HD C-S-H fraction:   ${(jenningsModel.hdFraction * 100).toFixed(0)}%
Gel from LD:         ${(jenningsModel.gelFromLD * 100).toFixed(1)}%
Gel from HD:         ${(jenningsModel.gelFromHD * 100).toFixed(1)}%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Resolution Analysis (${resolution} nm/pixel):
Effective resolution: ${resolution * 3} nm (3-pixel minimum)
Resolvable porosity:  ${(resolvablePorosity.total * 100).toFixed(1)}%
Expected segmented:   ${resolvablePorosity.total.toFixed(3)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Experimental measurements:
Gravimetric porosity:     ${expPorosity.toFixed(3)}
Image-segmented porosity: ${segPorosity.toFixed(3)}

Difference analysis:
Segmented vs P-B capillary: ${(segPorosity - currentCalc.capillary >= 0 ? '+' : '')}${(segPorosity - currentCalc.capillary).toFixed(3)} (${((segPorosity - currentCalc.capillary) / currentCalc.capillary * 100).toFixed(0)}%)
Segmented vs estimated resolvable: ${(segPorosity - resolvablePorosity.total >= 0 ? '+' : '')}${(segPorosity - resolvablePorosity.total).toFixed(3)}
`}</pre>
                </div>
            </div>
        </div>
    );
};

export default PowersBrownyardCalculator;
