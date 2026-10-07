"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const DEMO_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoicmFodWwuc2hhcm1hQGV4YW1wbGUuY29tIiwibmFtZSI6IlJhaHVsIFNoYXJtYSIsImlhdCI6MTc5MTEyNTc5NSwiZXhwIjoxNzkxNzMwNTk1fQ.GQqUJVwTFcCM45qS1S11Ab8yiZuSFxYnhBwVDOlUvS0";

export interface DashboardMetrics {
  totalRecords: number;
  hospitalVerified: number;
  activeMeds: number;
  lastHbA1c: string;
  bloodPressure: string;
  historyCoverage: string;
}

export interface PatientDashboardContextType {
  loading: boolean;
  userData: any | null;
  metrics: DashboardMetrics;
  documents: any[];
  timelineEvents: any[];
  recordedMedicines: any[];
  refresh: () => Promise<void>;

  // Modals & detail states
  selectedSummaryRecord: any | null;
  setSelectedSummaryRecord: (doc: any | null) => void;

  addTimelineModalOpen: boolean;
  setAddTimelineModalOpen: (open: boolean) => void;
  submittingTimeline: boolean;
  newTimeline: any;
  setNewTimeline: React.Dispatch<React.SetStateAction<any>>;
  handleAddTimeline: (e: React.FormEvent) => Promise<void>;

  addMedicineModalOpen: boolean;
  setAddMedicineModalOpen: (open: boolean) => void;
  submittingMedicine: boolean;
  newMedicine: any;
  setNewMedicine: React.Dispatch<React.SetStateAction<any>>;
  handleAddMedicine: (e: React.FormEvent) => Promise<void>;

  ocrModalOpen: boolean;
  setOcrModalOpen: (open: boolean) => void;
  notification: string | null;
  setNotification: (msg: string | null) => void;
}

const PatientDashboardContext = createContext<PatientDashboardContextType | null>(null);

export function usePatientDashboard(): PatientDashboardContextType {
  const ctx = useContext(PatientDashboardContext);
  if (!ctx) {
    throw new Error("usePatientDashboard must be used within a PatientDashboardProvider");
  }
  return ctx;
}

// Also export alias useDashboard for compatibility
export const useDashboard = usePatientDashboard;

export function PatientDashboardProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalRecords: 0,
    hospitalVerified: 0,
    activeMeds: 0,
    lastHbA1c: "--",
    bloodPressure: "--",
    historyCoverage: "0%",
  });
  const [documents, setDocuments] = useState<any[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [recordedMedicines, setRecordedMedicines] = useState<any[]>([]);
  const [notification, setNotification] = useState<string | null>(null);

  // Selected summary record for full detail modal
  const [selectedSummaryRecord, setSelectedSummaryRecord] = useState<any | null>(null);

  // Add Timeline Entry Modal state
  const [addTimelineModalOpen, setAddTimelineModalOpen] = useState(false);
  const [submittingTimeline, setSubmittingTimeline] = useState(false);
  const [newTimeline, setNewTimeline] = useState({
    event_date: new Date().toISOString().split("T")[0],
    category: "Symptom Report",
    title: "",
    description: "",
    source: "Manual Entry",
    facility: "Patient Home Portal",
    doctor: "Rahul Sharma (Patient Self-Report)",
    reliability: "Low",
    verification_status: "Patient Confirmed",
    reference_id: "",
    is_conflicting: false,
    conflict_details: "",
  });

  // Add Medicine Modal state
  const [addMedicineModalOpen, setAddMedicineModalOpen] = useState(false);
  const [submittingMedicine, setSubmittingMedicine] = useState(false);
  const [newMedicine, setNewMedicine] = useState({
    name: "",
    strength: "",
    status: "ACTIVE",
    indication: "",
    frequency: "Once daily",
    route: "Oral",
    start_date: new Date().toISOString().split("T")[0],
    doctor: "Dr. Priya Deshmukh",
    reference_id: "",
    source: "Hospital HMS",
    reliability: "High",
    verification_status: "Hospital Verified",
    is_conflicting: false,
    conflict_details: "",
  });

  // OCR quick scan modal state
  const [ocrModalOpen, setOcrModalOpen] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      let token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      if (!token) {
        if (typeof window !== "undefined") {
          localStorage.setItem("auth_token", DEMO_JWT);
        }
        token = DEMO_JWT;
      }

      const res = await fetch("/api/user/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        if (typeof window !== "undefined") {
          localStorage.setItem("auth_token", DEMO_JWT);
        }
        return fetchDashboardData();
      }

      const data = await res.json();
      if (data.success) {
        if (data.user) setUserData(data.user);
        if (data.metrics) setMetrics(data.metrics);
        if (data.documents) setDocuments(data.documents);
        if (data.timelineEvents) setTimelineEvents(data.timelineEvents);
        if (data.recordedMedicines) setRecordedMedicines(data.recordedMedicines);
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleAddTimeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTimeline.title.trim()) return;
    try {
      setSubmittingTimeline(true);
      const token = (typeof window !== "undefined" && localStorage.getItem("auth_token")) || DEMO_JWT;
      const res = await fetch("/api/patient/timeline", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newTimeline),
      });
      const resData = await res.json();
      if (resData.success) {
        setAddTimelineModalOpen(false);
        setNewTimeline({
          event_date: new Date().toISOString().split("T")[0],
          category: "Symptom Report",
          title: "",
          description: "",
          source: "Manual Entry",
          facility: "Patient Home Portal",
          doctor: "Rahul Sharma (Patient Self-Report)",
          reliability: "Low",
          verification_status: "Patient Confirmed",
          reference_id: "",
          is_conflicting: false,
          conflict_details: "",
        });
        setNotification("Timeline note added successfully!");
        await fetchDashboardData();
      } else {
        alert(resData.error || "Failed to save timeline entry");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSubmittingTimeline(false);
    }
  };

  const handleAddMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedicine.name.trim()) return;
    try {
      setSubmittingMedicine(true);
      const token = (typeof window !== "undefined" && localStorage.getItem("auth_token")) || DEMO_JWT;
      const res = await fetch("/api/patient/medicines", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newMedicine),
      });
      const resData = await res.json();
      if (resData.success) {
        setAddMedicineModalOpen(false);
        setNewMedicine({
          name: "",
          strength: "",
          status: "ACTIVE",
          indication: "",
          frequency: "Once daily",
          route: "Oral",
          start_date: new Date().toISOString().split("T")[0],
          doctor: "Dr. Priya Deshmukh",
          reference_id: "",
          source: "Hospital HMS",
          reliability: "High",
          verification_status: "Hospital Verified",
          is_conflicting: false,
          conflict_details: "",
        });
        setNotification("New medication order recorded successfully!");
        await fetchDashboardData();
      } else {
        alert(resData.error || "Failed to save medicine record");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSubmittingMedicine(false);
    }
  };

  return (
    <PatientDashboardContext.Provider
      value={{
        loading,
        userData,
        metrics,
        documents,
        timelineEvents,
        recordedMedicines,
        refresh: fetchDashboardData,
        selectedSummaryRecord,
        setSelectedSummaryRecord,
        addTimelineModalOpen,
        setAddTimelineModalOpen,
        submittingTimeline,
        newTimeline,
        setNewTimeline,
        handleAddTimeline,
        addMedicineModalOpen,
        setAddMedicineModalOpen,
        submittingMedicine,
        newMedicine,
        setNewMedicine,
        handleAddMedicine,
        ocrModalOpen,
        setOcrModalOpen,
        notification,
        setNotification,
      }}
    >
      {children}
    </PatientDashboardContext.Provider>
  );
}
