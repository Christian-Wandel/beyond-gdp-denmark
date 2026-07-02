"""Beyond GDP Denmark — Scenario comparator calculation engine.

Computes GHG impact deltas when swapping energy provisioning mixes.
Core logic: sector × fuel × GJ × emission_coefficient → tCO2e

Usage:
    python compute_scenarios.py                     # compute all scenarios → data/scenarios.json
    python compute_scenarios.py --year 2024         # single year
    python compute_scenarios.py --sector transport  # show sector breakdown
    python compute_scenarios.py --list-scenarios    # list available scenarios

Architecture:
    1. Load dst_energy_by_sector.json (sector × fuel × year cube in GJ)
    2. Load emission_coefficients.json (tCO2e/GJ per fuel)
    3. Apply coefficients to get baseline tCO2e by sector × fuel × year
    4. Apply scenario provisioning swaps to get counterfactual tCO2e
    5. Compute delta = counterfactual - baseline → GHG avoided
    6. Write data/scenarios.json for dashboard consumption
"""

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).parent
DATA_DIR = ROOT / "data"


def load_data():
    sector_path = DATA_DIR / "dst_energy_by_sector.json"
    coeff_path  = DATA_DIR / "emission_coefficients.json"

    with open(sector_path, encoding="utf-8") as f:
        sector_data = json.load(f)
    with open(coeff_path, encoding="utf-8") as f:
        coeff_data = json.load(f)

    # by_sector structure: {sector: {fossil_total, renewable_total, by_fuel: {fuel: {year: GJ}}}}
    # Unwrap to flat {sector: {fuel: {year: GJ}}} for uniform access
    raw_cube = sector_data["data"]["DNK"]["breakdown"]["by_sector"]
    cube = {sector: vals["by_fuel"] for sector, vals in raw_cube.items()}
    coeffs = coeff_data["coefficients"]
    grid_factors = coeff_data.get("grid_emission_factor", {})
    heat_factors = coeff_data.get("heat_emission_factor", {})
    return cube, coeffs, grid_factors, heat_factors


def get_grid_factor(year_str, grid_factors):
    """Return tCO2e/GJ for electricity at a given year (nearest year lookup)."""
    year = int(year_str[:4])
    available = sorted(int(y) for y in grid_factors if y.isdigit())
    if not available:
        return 0.0228  # 2024 default
    nearest = min(available, key=lambda y: abs(y - year))
    return grid_factors[str(nearest)]["tCO2e_per_GJ"]


def get_heat_factor(year_str, heat_factors):
    """Return tCO2e/GJ for district heat at a given year (nearest year lookup)."""
    year = int(year_str[:4])
    available = sorted(int(y) for y in heat_factors if y.isdigit())
    if not available:
        return 0.0119  # 2024 default
    nearest = min(available, key=lambda y: abs(y - year))
    return heat_factors[str(nearest)]["tCO2e_per_GJ"]


def compute_sector_emissions(sector_cube, coeffs, grid_factors, heat_factors, year):
    """Compute tCO2e by sector × fuel for a given year.

    Returns dict: {sector: {fuel: tCO2e, ..., "_total": tCO2e}}
    """
    results = {}
    for sector, fuel_data in sector_cube.items():
        results[sector] = {}
        sector_total = 0.0
        for fuel, year_series in fuel_data.items():
            gj = year_series.get(year, 0.0)
            if gj == 0.0:
                continue
            coeff = coeffs.get(fuel, {})
            factor = coeff.get("tCO2e_per_GJ")
            # End-use vectors: use grid/heat marginal factor
            if factor is None:
                if fuel == "electricity":
                    factor = get_grid_factor(year, grid_factors)
                elif fuel == "district_heat":
                    factor = get_heat_factor(year, heat_factors)
                else:
                    factor = 0.0
            tco2e = gj * factor
            results[sector][fuel] = round(tco2e, 1)
            sector_total += tco2e
        results[sector]["_total"] = round(sector_total, 1)
    return results


# ── Scenario definitions ─────────────────────────────────────────────────────
# Each scenario describes a provisioning swap.
# "swap": {fuel_from: fuel_to, fraction: 0–1}
# Applied per sector (or all sectors if sector="*").
# fraction=1.0 means 100% of that fuel is replaced.

SCENARIOS = {
    "transport_full_ev": {
        "label": "Road transport: 100% electric vehicles",
        "description": "Replace all petrol + diesel used by households (private cars) and construction/public sector fleets with electricity. DST classification note: private car fuel sits under 'households' (EHUSHOLD), not the transport sector (VH = commercial shipping/aviation/rail). Aviation jet_fuel excluded.",
        "year": "2024",
        "swaps": [
            {"sector": "households",    "from": "petrol", "to": "electricity", "fraction": 1.0},
            {"sector": "households",    "from": "diesel", "to": "electricity", "fraction": 0.7},
            {"sector": "construction",  "from": "diesel", "to": "electricity", "fraction": 0.6},
            {"sector": "public",        "from": "petrol", "to": "electricity", "fraction": 1.0},
            {"sector": "public",        "from": "diesel", "to": "electricity", "fraction": 0.8},
        ],
    },
    "transport_ev_2030": {
        "label": "Road transport: 30% EV penetration (Klimaloven 2030 target)",
        "description": "30% of private car petrol and 15% of household diesel replaced by electricity. Danish government 2030 EV-share target. Targets households sector where private car fuel is classified.",
        "year": "2024",
        "swaps": [
            {"sector": "households", "from": "petrol", "to": "electricity", "fraction": 0.30},
            {"sector": "households", "from": "diesel", "to": "electricity", "fraction": 0.15},
        ],
    },
    "households_heat_pumps": {
        "label": "Households: replace all gas boilers + heating oil with heat pumps",
        "description": "Full substitution of natural_gas and heating_oil in households with heat pumps. Models 1M heat pump target.",
        "year": "2024",
        "swaps": [
            {"sector": "households", "from": "natural_gas",  "to": "heat_pumps", "fraction": 1.0},
            {"sector": "households", "from": "heating_oil",  "to": "heat_pumps", "fraction": 1.0},
        ],
    },
    "households_heat_partial": {
        "label": "Households: 50% fossil heating replaced with heat pumps",
        "description": "Partial heat pump penetration — midpoint between current state and full transition.",
        "year": "2024",
        "swaps": [
            {"sector": "households", "from": "natural_gas", "to": "heat_pumps", "fraction": 0.5},
            {"sector": "households", "from": "heating_oil", "to": "heat_pumps", "fraction": 0.5},
        ],
    },
    "industry_coal_to_biomass": {
        "label": "Industry: replace coal + coke with biomass (wood chips)",
        "description": "Full coal phase-out in manufacturing, replaced with wood chips. Models Danish coal phase-out policy (2028 hard coal ban in power/heat).",
        "year": "2024",
        "swaps": [
            {"sector": "manufacturing", "from": "coal", "to": "wood_chips", "fraction": 1.0},
            {"sector": "manufacturing", "from": "coke", "to": "wood_chips", "fraction": 0.5},
        ],
    },
    "agriculture_fossil_heating": {
        "label": "Agriculture: replace heating oil with heat pumps + solar thermal",
        "description": "Greenhouses and farm buildings switch from heating_oil to heat_pumps (60%) + solar_thermal (40%).",
        "year": "2024",
        "swaps": [
            {"sector": "agriculture", "from": "heating_oil", "to": "heat_pumps",    "fraction": 0.6},
            {"sector": "agriculture", "from": "heating_oil", "to": "solar_thermal", "fraction": 0.4},
        ],
    },
    "klimaloven_2030_combined": {
        "label": "Klimaloven 2030: combined transport + heating transition",
        "description": "30% EV (transport) + 50% heat pump (households) + coal phase-out (industry). Approximate combined impact of flagship 2030 policies.",
        "year": "2024",
        "swaps": [
            {"sector": "households",    "from": "petrol",       "to": "electricity", "fraction": 0.30},
            {"sector": "households",    "from": "diesel",       "to": "electricity", "fraction": 0.15},
            {"sector": "households",    "from": "natural_gas",  "to": "heat_pumps",  "fraction": 0.50},
            {"sector": "households",    "from": "heating_oil",  "to": "heat_pumps",  "fraction": 0.50},
            {"sector": "manufacturing", "from": "coal",         "to": "wood_chips",  "fraction": 1.00},
        ],
    },
}


def apply_scenario(cube, scenario, coeffs, grid_factors, heat_factors):
    """Apply a provisioning swap scenario and return baseline + counterfactual emissions.

    Returns:
        {
            year: str,
            baseline_tco2e: float (total across all sectors),
            counterfactual_tco2e: float,
            delta_tco2e: float (negative = emissions avoided),
            delta_pct: float,
            by_sector: {
                sector: {
                    baseline: float,
                    counterfactual: float,
                    delta: float,
                    swaps: [{from, to, fraction, gj_swapped, delta_tco2e}]
                }
            }
        }
    """
    year = scenario.get("year", "2024")
    swaps = scenario.get("swaps", [])

    baseline_by_sector    = compute_sector_emissions(cube, coeffs, grid_factors, heat_factors, year)
    counterfactual = {s: dict(vals) for s, vals in baseline_by_sector.items()}

    swap_log = {s: [] for s in cube}

    for swap in swaps:
        sector   = swap["sector"]
        fuel_from = swap["from"]
        fuel_to   = swap["to"]
        fraction  = swap["fraction"]

        if sector not in cube:
            continue

        gj_from = cube[sector].get(fuel_from, {}).get(year, 0.0)
        gj_swapped = gj_from * fraction

        # Emissions from the swapped GJ under the old fuel
        old_coeff = _get_factor(fuel_from, year, coeffs, grid_factors, heat_factors)
        new_coeff = _get_factor(fuel_to,   year, coeffs, grid_factors, heat_factors)

        old_tco2e = gj_swapped * old_coeff
        new_tco2e = gj_swapped * new_coeff
        delta     = new_tco2e - old_tco2e  # negative = emissions avoided

        # Adjust counterfactual: remove old fuel emissions, add new
        counterfactual[sector][fuel_from] = round(
            counterfactual[sector].get(fuel_from, 0.0) - old_tco2e + 0.0, 1
        )
        counterfactual[sector][fuel_to] = round(
            counterfactual[sector].get(fuel_to, 0.0) + new_tco2e, 1
        )
        counterfactual[sector]["_total"] = round(
            counterfactual[sector]["_total"] + delta, 1
        )

        swap_log[sector].append({
            "from":       fuel_from,
            "to":         fuel_to,
            "fraction":   fraction,
            "gj_swapped": round(gj_swapped, 0),
            "delta_tco2e": round(delta, 1),
        })

    # Aggregate
    baseline_total      = sum(v["_total"] for v in baseline_by_sector.values() if "_total" in v)
    counterfactual_total = sum(v["_total"] for v in counterfactual.values() if "_total" in v)
    delta_total = counterfactual_total - baseline_total

    by_sector_out = {}
    for sector in cube:
        b = baseline_by_sector[sector].get("_total", 0.0)
        c = counterfactual[sector].get("_total", 0.0)
        by_sector_out[sector] = {
            "baseline_tco2e":      round(b, 1),
            "counterfactual_tco2e": round(c, 1),
            "delta_tco2e":         round(c - b, 1),
            "swaps":               swap_log[sector],
        }

    return {
        "year":                   year,
        "baseline_tco2e":         round(baseline_total, 0),
        "counterfactual_tco2e":   round(counterfactual_total, 0),
        "delta_tco2e":            round(delta_total, 0),
        "delta_pct":              round(100 * delta_total / baseline_total, 1) if baseline_total else 0,
        "by_sector":              by_sector_out,
    }


def _get_factor(fuel, year, coeffs, grid_factors, heat_factors):
    coeff = coeffs.get(fuel, {})
    factor = coeff.get("tCO2e_per_GJ")
    if factor is None:
        if fuel == "electricity":
            return get_grid_factor(year, grid_factors)
        elif fuel == "district_heat":
            return get_heat_factor(year, heat_factors)
        return 0.0
    return factor


def run_all_scenarios(year=None):
    cube, coeffs, grid_factors, heat_factors = load_data()

    results = {}
    for scenario_id, scenario in SCENARIOS.items():
        sc = dict(scenario)
        if year:
            sc["year"] = year
        result = apply_scenario(cube, sc, coeffs, grid_factors, heat_factors)
        results[scenario_id] = {
            "label":       scenario["label"],
            "description": scenario["description"],
            **result,
        }
        delta = result["delta_tco2e"]
        pct   = result["delta_pct"]
        sign  = "+" if delta > 0 else ""
        print(f"  {scenario_id:<35} {sign}{delta:,.0f} tCO2e  ({sign}{pct}%)")

    out_path = DATA_DIR / "scenarios.json"
    out_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n  Written -> {out_path}")
    return results


def print_sector_breakdown(sector_name, year="2024"):
    cube, coeffs, grid_factors, heat_factors = load_data()
    emissions = compute_sector_emissions(cube, coeffs, grid_factors, heat_factors, year)

    if sector_name not in emissions:
        print(f"Sector '{sector_name}' not found. Available: {list(emissions)}")
        return

    sector_data = {k: v for k, v in emissions[sector_name].items() if k != "_total"}
    sorted_fuels = sorted(sector_data.items(), key=lambda x: x[1], reverse=True)

    total = emissions[sector_name].get("_total", 0.0)
    print(f"\nEmissions — sector: {sector_name}, year: {year}")
    print(f"{'Fuel':<20} {'tCO2e':>12}   {'Share':>7}")
    print("-" * 44)
    for fuel, tco2e in sorted_fuels:
        if tco2e == 0.0:
            continue
        share = 100 * tco2e / total if total else 0
        print(f"  {fuel:<18} {tco2e:>12,.1f}   {share:>6.1f}%")
    print(f"  {'TOTAL':<18} {total:>12,.1f}   100.0%")


def main():
    ap = argparse.ArgumentParser(description="Scenario comparator engine")
    ap.add_argument("--year",            metavar="YYYY", help="Override scenario year (default: each scenario's own year)")
    ap.add_argument("--sector",          metavar="NAME", help="Print emission breakdown for a sector")
    ap.add_argument("--list-scenarios",  action="store_true", help="List available scenarios")
    args = ap.parse_args()

    if args.list_scenarios:
        print("\nAvailable scenarios:\n")
        for sid, sc in SCENARIOS.items():
            print(f"  {sid}")
            print(f"    {sc['label']}")
        return

    if args.sector:
        year = args.year or "2024"
        print_sector_breakdown(args.sector, year)
        return

    print("Computing scenarios...\n")
    run_all_scenarios(year=args.year)


if __name__ == "__main__":
    main()
