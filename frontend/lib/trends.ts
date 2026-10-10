/**
 * Clinical Trajectory & Risk Stratification Engine
 * 
 * Implements deterministic clinical guidelines:
 * - AHA/ACC 2017 Guidelines for Blood Pressure (Normal, Elevated, Stage 1, Stage 2, Crisis)
 * - ADA 2024 Standards of Care for Glycemia (FBS, PPBS/RBS, HbA1c)
 * - Standard Clinical Biomarker Reference Ranges (Pulse, SpO2, Weight)
 * - Pairwise delta computation, chronological ordering, and velocity tracking.
 * 
 * Reference: KRISHNA.md
 */

export type ClinicalStage = 
  | "Normal" 
  | "Optimal"
  | "Elevated" 
  | "Stage 1 Hypertension" 
  | "Stage 2 Hypertension" 
  | "Hypertensive Crisis"
  | "Prediabetes"
  | "Diabetic"
  | "Hypoglycemia"
  | "Bradycardia"
  | "Tachycardia"
  | "Mild Hypoxia"
  | "Critical Hypoxia"
  | "Standard";

export type RiskLevel = "optimal" | "borderline" | "warning" | "critical";

export interface VitalDataPoint {
  id: number | string;
  prescriptionId?: number | string | null;
  documentId?: number | string | null;
  documentName?: string | null;
  doctor?: string | null;
  hospital?: string | null;
  filePath?: string | null;
  imageUrl?: string | null;
  date: string; // YYYY-MM-DD
  kind: string;
  systolic?: number | null;
  diastolic?: number | null;
  value?: number | null;
  unit: string;
  rawText?: string | null;

  // Computed metrics
  stage: ClinicalStage;
  riskLevel: RiskLevel;
  stageColor: string;
  badgeBg: string;
  badgeText: string;

  // Pairwise deltas relative to previous visit
  prevDate?: string | null;
  daysSincePrev?: number | null;
  deltaValue?: number | null;
  deltaSystolic?: number | null;
  deltaDiastolic?: number | null;
  velocityPerMonth?: number | null; // delta per 30 days
  trendDirection?: "up" | "down" | "flat" | null;
}

export interface MetricTrendSummary {
  metricKey: string;
  metricLabel: string;
  unit: string;
  count: number;
  dataPoints: VitalDataPoint[];
  
  latest: VitalDataPoint | null;
  baseline: VitalDataPoint | null;
  
  // Aggregate statistics
  minValue: number | null;
  maxValue: number | null;
  avgValue: number | null;
  
  // For BP
  avgSystolic?: number | null;
  avgDiastolic?: number | null;
  latestSystolic?: number | null;
  latestDiastolic?: number | null;
  totalDeltaSystolic?: number | null;
  totalDeltaDiastolic?: number | null;

  // Trajectory analysis
  overallDelta: number | null; // latest - baseline
  overallTrend: "improving" | "worsening" | "stable" | "fluctuating" | "insufficient_data";
  sustainedRiseWarning: boolean;
  activeAlerts: string[];
}

export interface PatientLongitudinalTrends {
  patientId: string;
  totalEncounters: number;
  dateRange: {
    start: string | null;
    end: string | null;
  };
  metrics: {
    bp: MetricTrendSummary;
    glucose: MetricTrendSummary;
    hba1c: MetricTrendSummary;
    pulse: MetricTrendSummary;
    spo2: MetricTrendSummary;
    weight: MetricTrendSummary;
  };
  allAlerts: string[];
  clinicalSummary: {
    hypertensionStatus: string;
    glycemicStatus: string;
    overallRiskTier: "Low / Well-Managed" | "Moderate / Needs Monitoring" | "High / Clinical Review Recommended";
  };
}

/**
 * Categorize Blood Pressure reading per AHA/ACC Guidelines
 */
export function categorizeBloodPressure(systolic: number, diastolic: number): {
  stage: ClinicalStage;
  riskLevel: RiskLevel;
  stageColor: string;
  badgeBg: string;
  badgeText: string;
  description: string;
} {
  if (systolic > 180 || diastolic > 120) {
    return {
      stage: "Hypertensive Crisis",
      riskLevel: "critical",
      stageColor: "#dc2626", // red-600
      badgeBg: "bg-red-100 border-red-300",
      badgeText: "text-red-800",
      description: "Critical elevation requiring urgent clinical evaluation (Systolic >180 and/or Diastolic >120 mmHg).",
    };
  }
  if (systolic >= 140 || diastolic >= 90) {
    return {
      stage: "Stage 2 Hypertension",
      riskLevel: "warning",
      stageColor: "#ef4444", // red-500
      badgeBg: "bg-rose-100 border-rose-300",
      badgeText: "text-rose-800",
      description: "Systolic ≥140 or Diastolic ≥90 mmHg per AHA/ACC 2017 Guidelines.",
    };
  }
  if ((systolic >= 130 && systolic <= 139) || (diastolic >= 80 && diastolic <= 89)) {
    return {
      stage: "Stage 1 Hypertension",
      riskLevel: "borderline",
      stageColor: "#f97316", // orange-500
      badgeBg: "bg-amber-100 border-amber-300",
      badgeText: "text-amber-800",
      description: "Systolic 130–139 or Diastolic 80–89 mmHg. Lifestyle & pharmacological review recommended.",
    };
  }
  if (systolic >= 120 && systolic <= 129 && diastolic < 80) {
    return {
      stage: "Elevated",
      riskLevel: "borderline",
      stageColor: "#eab308", // yellow-500
      badgeBg: "bg-yellow-100 border-yellow-300",
      badgeText: "text-yellow-800",
      description: "Systolic 120–129 and Diastolic <80 mmHg. Lifestyle modifications recommended.",
    };
  }
  return {
    stage: "Normal",
    riskLevel: "optimal",
    stageColor: "#10b981", // emerald-500
    badgeBg: "bg-emerald-100 border-emerald-300",
    badgeText: "text-emerald-800",
    description: "Systolic <120 and Diastolic <80 mmHg. Optimal cardiovascular range.",
  };
}

/**
 * Categorize Blood Sugar (FBS, PPBS/RBS) per ADA Guidelines
 */
export function categorizeBloodSugar(value: number, kind: string, unit: string = "mg/dL"): {
  stage: ClinicalStage;
  riskLevel: RiskLevel;
  stageColor: string;
  badgeBg: string;
  badgeText: string;
  description: string;
} {
  // Convert mmol/L to mg/dL if needed for unified thresholding
  const valMgDl = unit.toLowerCase().includes("mmol") ? value * 18.0182 : value;

  if (valMgDl < 70) {
    return {
      stage: "Hypoglycemia",
      riskLevel: "critical",
      stageColor: "#dc2626",
      badgeBg: "bg-red-100 border-red-300",
      badgeText: "text-red-800",
      description: "Low blood glucose (<70 mg/dL). Immediate carbohydrate intake or clinical check needed.",
    };
  }

  const isFasting = kind === "sugar_fasting";

  if (isFasting) {
    if (valMgDl >= 126) {
      return {
        stage: "Diabetic",
        riskLevel: "warning",
        stageColor: "#ef4444",
        badgeBg: "bg-rose-100 border-rose-300",
        badgeText: "text-rose-800",
        description: "Fasting glucose ≥126 mg/dL meets diabetic criteria per ADA.",
      };
    }
    if (valMgDl >= 100) {
      return {
        stage: "Prediabetes",
        riskLevel: "borderline",
        stageColor: "#f97316",
        badgeBg: "bg-amber-100 border-amber-300",
        badgeText: "text-amber-800",
        description: "Impaired Fasting Glucose (100–125 mg/dL) per ADA.",
      };
    }
    return {
      stage: "Normal",
      riskLevel: "optimal",
      stageColor: "#10b981",
      badgeBg: "bg-emerald-100 border-emerald-300",
      badgeText: "text-emerald-800",
      description: "Normal Fasting Blood Sugar (70–99 mg/dL).",
    };
  }

  // Random or Post-Prandial (PPBS / RBS)
  if (valMgDl >= 200) {
    return {
      stage: "Diabetic",
      riskLevel: "warning",
      stageColor: "#ef4444",
      badgeBg: "bg-rose-100 border-rose-300",
      badgeText: "text-rose-800",
      description: "Post-prandial / Random glucose ≥200 mg/dL meets diabetic threshold.",
    };
  }
  if (valMgDl >= 140) {
    return {
      stage: "Elevated",
      riskLevel: "borderline",
      stageColor: "#f97316",
      badgeBg: "bg-amber-100 border-amber-300",
      badgeText: "text-amber-800",
      description: "Elevated glucose (140–199 mg/dL). Impaired glucose tolerance.",
    };
  }
  return {
    stage: "Normal",
    riskLevel: "optimal",
    stageColor: "#10b981",
    badgeBg: "bg-emerald-100 border-emerald-300",
    badgeText: "text-emerald-800",
    description: "Normal post-meal or random glucose (<140 mg/dL).",
  };
}

/**
 * Categorize HbA1c per ADA Guidelines
 */
export function categorizeHbA1c(value: number): {
  stage: ClinicalStage;
  riskLevel: RiskLevel;
  stageColor: string;
  badgeBg: string;
  badgeText: string;
  description: string;
} {
  if (value >= 6.5) {
    return {
      stage: "Diabetic",
      riskLevel: "warning",
      stageColor: "#ef4444",
      badgeBg: "bg-rose-100 border-rose-300",
      badgeText: "text-rose-800",
      description: "HbA1c ≥6.5% indicates diabetes diagnosis/management zone.",
    };
  }
  if (value >= 5.7) {
    return {
      stage: "Prediabetes",
      riskLevel: "borderline",
      stageColor: "#f97316",
      badgeBg: "bg-amber-100 border-amber-300",
      badgeText: "text-amber-800",
      description: "HbA1c 5.7%–6.4% indicates prediabetes range per ADA.",
    };
  }
  return {
    stage: "Normal",
    riskLevel: "optimal",
    stageColor: "#10b981",
    badgeBg: "bg-emerald-100 border-emerald-300",
    badgeText: "text-emerald-800",
    description: "Normal glycemic control (HbA1c <5.7%).",
  };
}

/**
 * Categorize Pulse / Heart Rate
 */
export function categorizePulse(rate: number): {
  stage: ClinicalStage;
  riskLevel: RiskLevel;
  stageColor: string;
  badgeBg: string;
  badgeText: string;
  description: string;
} {
  if (rate < 60) {
    return {
      stage: "Bradycardia",
      riskLevel: "borderline",
      stageColor: "#3b82f6", // blue-500
      badgeBg: "bg-blue-100 border-blue-300",
      badgeText: "text-blue-800",
      description: "Heart rate <60 bpm (Bradycardia).",
    };
  }
  if (rate > 100) {
    return {
      stage: "Tachycardia",
      riskLevel: "warning",
      stageColor: "#ef4444",
      badgeBg: "bg-rose-100 border-rose-300",
      badgeText: "text-rose-800",
      description: "Heart rate >100 bpm (Tachycardia).",
    };
  }
  return {
    stage: "Normal",
    riskLevel: "optimal",
    stageColor: "#10b981",
    badgeBg: "bg-emerald-100 border-emerald-300",
    badgeText: "text-emerald-800",
    description: "Normal resting heart rate (60–100 bpm).",
  };
}

/**
 * Categorize SpO2 (Pulse Oximetry)
 */
export function categorizeSpO2(value: number): {
  stage: ClinicalStage;
  riskLevel: RiskLevel;
  stageColor: string;
  badgeBg: string;
  badgeText: string;
  description: string;
} {
  if (value < 90) {
    return {
      stage: "Critical Hypoxia",
      riskLevel: "critical",
      stageColor: "#dc2626",
      badgeBg: "bg-red-100 border-red-300",
      badgeText: "text-red-800",
      description: "Oxygen saturation <90% indicates severe hypoxemia.",
    };
  }
  if (value < 95) {
    return {
      stage: "Mild Hypoxia",
      riskLevel: "borderline",
      stageColor: "#f97316",
      badgeBg: "bg-amber-100 border-amber-300",
      badgeText: "text-amber-800",
      description: "Oxygen saturation 90%–94% indicates mild hypoxia.",
    };
  }
  return {
    stage: "Normal",
    riskLevel: "optimal",
    stageColor: "#10b981",
    badgeBg: "bg-emerald-100 border-emerald-300",
    badgeText: "text-emerald-800",
    description: "Healthy arterial oxygen saturation (≥95%).",
  };
}

/**
 * Calculate pairwise deltas and statistical trajectory for a given list of raw observations
 */
function buildMetricSummary(
  metricKey: string,
  metricLabel: string,
  unit: string,
  rawItems: any[],
  docLookup?: Map<number | string, any>
): MetricTrendSummary {
  if (!rawItems || rawItems.length === 0) {
    return {
      metricKey,
      metricLabel,
      unit,
      count: 0,
      dataPoints: [],
      latest: null,
      baseline: null,
      minValue: null,
      maxValue: null,
      avgValue: null,
      overallDelta: null,
      overallTrend: "insufficient_data",
      sustainedRiseWarning: false,
      activeAlerts: [],
    };
  }

  // 1. Sort strictly chronologically by date ascending, then ID ascending
  const sorted = [...rawItems].sort((a, b) => {
    const da = new Date(a.obs_date || a.date || "1970-01-01").getTime();
    const db = new Date(b.obs_date || b.date || "1970-01-01").getTime();
    if (da !== db) return da - db;
    return (Number(a.id) || 0) - (Number(b.id) || 0);
  });

  const dataPoints: VitalDataPoint[] = [];
  const alerts: string[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    const dateStr = (r.obs_date || r.date || "").toString().slice(0, 10);
    const rxId = r.prescription_id || r.prescriptionId || null;
    const docInfo = rxId && docLookup ? docLookup.get(rxId) : null;

    let stageInfo: ReturnType<typeof categorizeBloodPressure>;

    if (metricKey === "bp") {
      const sys = Number(r.systolic) || 0;
      const dia = Number(r.diastolic) || 0;
      stageInfo = categorizeBloodPressure(sys, dia);
    } else if (metricKey === "glucose") {
      const val = Number(r.value) || 0;
      stageInfo = categorizeBloodSugar(val, r.kind || "sugar_random", r.unit || unit);
    } else if (metricKey === "hba1c") {
      const val = Number(r.value) || 0;
      stageInfo = categorizeHbA1c(val);
    } else if (metricKey === "pulse") {
      const val = Number(r.value) || 0;
      stageInfo = categorizePulse(val);
    } else if (metricKey === "spo2") {
      const val = Number(r.value) || 0;
      stageInfo = categorizeSpO2(val);
    } else {
      // Weight or generic
      stageInfo = {
        stage: "Standard",
        riskLevel: "optimal",
        stageColor: "#0d9488",
        badgeBg: "bg-teal-100 border-teal-300",
        badgeText: "text-teal-800",
        description: "Recorded biomarker observation.",
      };
    }

    const point: VitalDataPoint = {
      id: r.id || `pt-${i}`,
      prescriptionId: rxId,
      documentId: docInfo?.id || null,
      documentName: docInfo?.originalName || null,
      doctor: docInfo?.doctor || null,
      hospital: docInfo?.hospital || null,
      filePath: docInfo?.filePath || null,
      imageUrl: docInfo?.imageUrl || null,
      date: dateStr,
      kind: r.kind,
      systolic: r.systolic != null ? Number(r.systolic) : null,
      diastolic: r.diastolic != null ? Number(r.diastolic) : null,
      value: r.value != null ? Number(r.value) : null,
      unit: r.unit || unit,
      rawText: r.raw_text || null,
      stage: stageInfo.stage,
      riskLevel: stageInfo.riskLevel,
      stageColor: stageInfo.stageColor,
      badgeBg: stageInfo.badgeBg,
      badgeText: stageInfo.badgeText,
    };

    // Calculate delta relative to previous point
    if (i > 0) {
      const prev = dataPoints[i - 1];
      point.prevDate = prev.date;

      const dCur = new Date(point.date).getTime();
      const dPrev = new Date(prev.date).getTime();
      const diffDays = Math.max(1, Math.round((dCur - dPrev) / (1000 * 60 * 60 * 24)));
      point.daysSincePrev = diffDays;

      if (metricKey === "bp") {
        if (point.systolic != null && prev.systolic != null) {
          point.deltaSystolic = Math.round(point.systolic - prev.systolic);
          point.trendDirection = point.deltaSystolic > 2 ? "up" : point.deltaSystolic < -2 ? "down" : "flat";
          point.velocityPerMonth = Number(((point.deltaSystolic / diffDays) * 30).toFixed(1));
        }
        if (point.diastolic != null && prev.diastolic != null) {
          point.deltaDiastolic = Math.round(point.diastolic - prev.diastolic);
        }
      } else {
        if (point.value != null && prev.value != null) {
          point.deltaValue = Number((point.value - prev.value).toFixed(1));
          point.trendDirection = point.deltaValue > 0.5 ? "up" : point.deltaValue < -0.5 ? "down" : "flat";
          point.velocityPerMonth = Number(((point.deltaValue / diffDays) * 30).toFixed(1));
        }
      }
    }

    // Flag any acute stage alerts
    if (point.riskLevel === "critical") {
      alerts.push(`Critical ${metricLabel} alert on ${point.date}: ${point.stage} (${point.systolic ? `${point.systolic}/${point.diastolic} mmHg` : `${point.value} ${point.unit}`})`);
    } else if (point.stage === "Stage 2 Hypertension") {
      alerts.push(`Stage 2 Hypertension recorded on ${point.date}: ${point.systolic}/${point.diastolic} mmHg.`);
    }

    dataPoints.push(point);
  }

  // Trajectory analysis & sustained rise detection
  let sustainedRiseWarning = false;
  if (metricKey === "bp" && dataPoints.length >= 3) {
    // Check if last 2 consecutive encounters showed systolic rise >= 10 mmHg total
    const last3 = dataPoints.slice(-3);
    const rise1 = (last3[1].systolic || 0) - (last3[0].systolic || 0);
    const rise2 = (last3[2].systolic || 0) - (last3[1].systolic || 0);
    if (rise1 > 0 && rise2 > 0 && (rise1 + rise2) >= 10) {
      sustainedRiseWarning = true;
      alerts.push(`Sustained BP Elevation Warning: Systolic BP increased by +${rise1 + rise2} mmHg across the last 3 clinical visits.`);
    }
  }

  const baseline = dataPoints[0];
  const latest = dataPoints[dataPoints.length - 1];

  let minValue: number | null = null;
  let maxValue: number | null = null;
  let avgValue: number | null = null;
  let avgSystolic: number | null = null;
  let avgDiastolic: number | null = null;
  let totalDeltaSystolic: number | null = null;
  let totalDeltaDiastolic: number | null = null;
  let overallDelta: number | null = null;

  if (metricKey === "bp") {
    const sysArr = dataPoints.map(p => p.systolic).filter((n): n is number => n != null);
    const diaArr = dataPoints.map(p => p.diastolic).filter((n): n is number => n != null);
    if (sysArr.length > 0) {
      minValue = Math.min(...sysArr);
      maxValue = Math.max(...sysArr);
      avgSystolic = Math.round(sysArr.reduce((a, b) => a + b, 0) / sysArr.length);
      avgDiastolic = Math.round(diaArr.reduce((a, b) => a + b, 0) / diaArr.length);
      if (latest?.systolic != null && baseline?.systolic != null) {
        totalDeltaSystolic = Math.round(latest.systolic - baseline.systolic);
      }
      if (latest?.diastolic != null && baseline?.diastolic != null) {
        totalDeltaDiastolic = Math.round(latest.diastolic - baseline.diastolic);
      }
    }
  } else {
    const valArr = dataPoints.map(p => p.value).filter((n): n is number => n != null);
    if (valArr.length > 0) {
      minValue = Math.min(...valArr);
      maxValue = Math.max(...valArr);
      avgValue = Number((valArr.reduce((a, b) => a + b, 0) / valArr.length).toFixed(1));
      if (latest?.value != null && baseline?.value != null) {
        overallDelta = Number((latest.value - baseline.value).toFixed(1));
      }
    }
  }

  // Determine overall trajectory
  let overallTrend: "improving" | "worsening" | "stable" | "fluctuating" | "insufficient_data" = "insufficient_data";
  if (dataPoints.length >= 2) {
    if (metricKey === "bp") {
      const delta = (latest?.systolic || 0) - (baseline?.systolic || 0);
      if (Math.abs(delta) <= 4) overallTrend = "stable";
      else if (delta < -4) overallTrend = "improving";
      else overallTrend = "worsening";
    } else {
      const delta = overallDelta || 0;
      if (Math.abs(delta) <= 3) overallTrend = "stable";
      else if (delta < 0) overallTrend = "improving";
      else overallTrend = "worsening";
    }
  }

  return {
    metricKey,
    metricLabel,
    unit,
    count: dataPoints.length,
    dataPoints,
    latest,
    baseline,
    minValue,
    maxValue,
    avgValue,
    avgSystolic,
    avgDiastolic,
    latestSystolic: latest?.systolic || null,
    latestDiastolic: latest?.diastolic || null,
    totalDeltaSystolic,
    totalDeltaDiastolic,
    overallDelta,
    overallTrend,
    sustainedRiseWarning,
    activeAlerts: alerts,
  };
}

/**
 * Main Longitudinal Analysis Coordinator:
 * Processes raw observations from DB and builds fully typed longitudinal metrics.
 */
export function calculatePatientTrends(
  patientId: string,
  rawObservations: any[],
  documents: any[] = []
): PatientLongitudinalTrends {
  // Build lookup map for documents by prescription/extraction ID
  const docLookup = new Map<number | string, any>();
  for (const doc of documents) {
    const pId = doc.id;
    docLookup.set(pId, doc);
    if (doc.structuredResult?.reference_id) {
      docLookup.set(doc.structuredResult.reference_id, doc);
    }
  }

  // Filter observations into canonical metric buckets
  const bpObs = rawObservations.filter(o => o.kind === "bp");
  const glucoseObs = rawObservations.filter(o => 
    o.kind === "sugar_fasting" || 
    o.kind === "sugar_post_meal" || 
    o.kind === "sugar_random" || 
    o.kind === "sugar_unspecified"
  );
  const hba1cObs = rawObservations.filter(o => o.kind === "hba1c");
  const pulseObs = rawObservations.filter(o => o.kind === "pulse");
  const spo2Obs = rawObservations.filter(o => o.kind === "spo2");
  const weightObs = rawObservations.filter(o => o.kind === "weight");

  const bpSummary = buildMetricSummary("bp", "Blood Pressure", "mmHg", bpObs, docLookup);
  const glucoseSummary = buildMetricSummary("glucose", "Blood Sugar", "mg/dL", glucoseObs, docLookup);
  const hba1cSummary = buildMetricSummary("hba1c", "HbA1c Glycemia", "%", hba1cObs, docLookup);
  const pulseSummary = buildMetricSummary("pulse", "Heart Rate", "bpm", pulseObs, docLookup);
  const spo2Summary = buildMetricSummary("spo2", "Oxygen Saturation", "%", spo2Obs, docLookup);
  const weightSummary = buildMetricSummary("weight", "Body Weight", "kg", weightObs, docLookup);

  // Aggregate all unique dates and alerts
  const allDates = rawObservations
    .map(o => (o.obs_date || o.date || "").toString().slice(0, 10))
    .filter(Boolean)
    .sort();

  const allAlerts = [
    ...bpSummary.activeAlerts,
    ...glucoseSummary.activeAlerts,
    ...hba1cSummary.activeAlerts,
    ...pulseSummary.activeAlerts,
    ...spo2Summary.activeAlerts,
  ];

  // Overall risk tier determination
  let overallRiskTier: "Low / Well-Managed" | "Moderate / Needs Monitoring" | "High / Clinical Review Recommended" = "Low / Well-Managed";
  if (
    bpSummary.latest?.riskLevel === "critical" ||
    glucoseSummary.latest?.riskLevel === "critical" ||
    hba1cSummary.latest?.riskLevel === "critical" ||
    spo2Summary.latest?.riskLevel === "critical" ||
    bpSummary.sustainedRiseWarning ||
    bpSummary.latest?.stage === "Stage 2 Hypertension"
  ) {
    overallRiskTier = "High / Clinical Review Recommended";
  } else if (
    bpSummary.latest?.riskLevel === "borderline" ||
    glucoseSummary.latest?.riskLevel === "borderline" ||
    hba1cSummary.latest?.riskLevel === "borderline" ||
    pulseSummary.latest?.riskLevel === "borderline"
  ) {
    overallRiskTier = "Moderate / Needs Monitoring";
  }

  const hypertensionStatus = bpSummary.latest 
    ? `${bpSummary.latest.stage} (${bpSummary.latest.systolic}/${bpSummary.latest.diastolic} mmHg)`
    : "No BP readings recorded";

  const glycemicStatus = hba1cSummary.latest
    ? `${hba1cSummary.latest.stage} (HbA1c ${hba1cSummary.latest.value}%)`
    : glucoseSummary.latest
    ? `${glucoseSummary.latest.stage} (Sugar ${glucoseSummary.latest.value} ${glucoseSummary.latest.unit})`
    : "No glycemic tests recorded";

  return {
    patientId,
    totalEncounters: new Set(allDates).size,
    dateRange: {
      start: allDates[0] || null,
      end: allDates[allDates.length - 1] || null,
    },
    metrics: {
      bp: bpSummary,
      glucose: glucoseSummary,
      hba1c: hba1cSummary,
      pulse: pulseSummary,
      spo2: spo2Summary,
      weight: weightSummary,
    },
    allAlerts,
    clinicalSummary: {
      hypertensionStatus,
      glycemicStatus,
      overallRiskTier,
    },
  };
}
