
import React, { useEffect, useMemo, useState } from "react";
import {
  initializeApp,
  getApps,
} from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import {
  Trophy,
  Users,
  Target,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Medal,
  Quote,
  LoaderCircle,
  CheckCircle2,
  LockKeyhole,
  TrendingUp,
} from "lucide-react";

// =====================================================
// 1. FIREBASE CONFIGURATION
// =====================================================

const firebaseConfig = {
  apiKey: "AIzaSyCvSjpXlv8dKvJp2ELim6HQb1twHQ528_4",
  authDomain: "ascendprospectingtracker.firebaseapp.com",
  projectId: "ascendprospectingtracker",
  storageBucket: "ascendprospectingtracker.firebasestorage.app",
  messagingSenderId: "724787564489",
  appId: "1:724787564489:web:9536209c91f6740136a218",
  measurementId: "G-PT5RDE54HR"
};

const app = getApps().length
  ? getApps()[0]
  : initializeApp(firebaseConfig);

const db = getFirestore(app);

// =====================================================
// 2. BOOTCAMP CONFIGURATION
// =====================================================

// IMPORTANT: Change this to your actual bootcamp start date.
const BOOTCAMP_START = "2026-11-01";

const BOOTCAMP_ID = "ascend-30-day-bootcamp";

const TEAM_NAME = "ASCEND TEAM";

const DAYS = Array.from({ length: 30 }, (_, i) => i + 1);

const WEEKS = [
  { label: "Week 1", start: 1, end: 7 },
  { label: "Week 2", start: 8, end: 14 },
  { label: "Week 3", start: 15, end: 21 },
  { label: "Week 4", start: 22, end: 28 },
  { label: "Final 2 Days", start: 29, end: 30 },
];

// =====================================================
// 3. DAILY MOTIVATIONAL QUOTES
// =====================================================

const QUOTES = [
  {
    text: "It always seems impossible until it's done.",
    author: "Nelson Mandela",
    source: "Attributed to Nelson Mandela",
  },
  {
    text: "Great things are done by a series of small things brought together.",
    author: "Vincent van Gogh",
    source: "Letters of Vincent van Gogh",
  },
  {
    text: "The secret of getting ahead is getting started.",
    author: "Mark Twain",
    source: "Commonly attributed to Mark Twain; attribution disputed",
  },
  {
    text: "Success is the sum of small efforts, repeated day in and day out.",
    author: "Robert Collier",
    source: "The Secret of the Ages",
  },
  {
    text: "Well done is better than well said.",
    author: "Benjamin Franklin",
    source: "Poor Richard's Almanack",
  },
  {
    text: "You don't have to see the whole staircase, just take the first step.",
    author: "Martin Luther King Jr.",
    source: "Commonly attributed quotation",
  },
  {
    text: "Energy and persistence conquer all things.",
    author: "Benjamin Franklin",
    source: "Attributed to Benjamin Franklin",
  },
];

// =====================================================
// 4. HELPER FUNCTIONS
// =====================================================

const getLagosDate = () => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
};

const getCurrentDay = () => {
  const start = new Date(`${BOOTCAMP_START}T00:00:00`);
  const current = new Date(`${getLagosDate()}T00:00:00`);

  return Math.floor((current - start) / 86400000) + 1;
};

const getBootcampStatus = () => {
  const day = getCurrentDay();

  if (day < 1) return "UPCOMING";
  if (day > 30) return "COMPLETED";
  return "LIVE";
};

const getWeek = (day) => {
  return WEEKS.find(
    (week) => day >= week.start && day <= week.end
  );
};

const getInitials = (name = "") => {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
};

const getDailyQuote = () => {
  const date = getLagosDate();
  const index =
    [...date].reduce((total, char) => total + char.charCodeAt(0), 0) %
    QUOTES.length;

  return QUOTES[index];
};

// This is a client-side hash, not a substitute for
// server-side PIN security in a public production app.
const hashPin = async (pin) => {
  const data = new TextEncoder().encode(pin);
  const hash = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const formatNumber = (number) =>
  new Intl.NumberFormat("en-NG").format(number || 0);

// =====================================================
// 5. MAIN APPLICATION
// =====================================================

export default function App() {
  const [participants, setParticipants] = useState([]);
  const [records, setRecords] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [view, setView] = useState("bootcamp");
  const [selectedDay, setSelectedDay] = useState(
    Math.min(30, Math.max(1, getCurrentDay()))
  );
  const [selectedWeek, setSelectedWeek] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [formError, setFormError] = useState("");

  const [mode, setMode] = useState("returning");

  const [form, setForm] = useState({
    day: String(Math.min(30, Math.max(1, getCurrentDay()))),
    name: "",
    pin: "",
    confirmPin: "",
    contacts: "",
  });

  const currentDay = getCurrentDay();
  const status = getBootcampStatus();

  // ===================================================
  // 6. FIRESTORE REAL-TIME LISTENERS
  // ===================================================

  useEffect(() => {
    const participantsQuery = query(
      collection(db, "participants"),
      where("bootcampId", "==", BOOTCAMP_ID)
    );

    const recordsQuery = query(
      collection(db, "daily_records"),
      where("bootcampId", "==", BOOTCAMP_ID)
    );

    let participantsLoaded = false;
    let recordsLoaded = false;

    const unsubscribeParticipants = onSnapshot(
      participantsQuery,
      (snapshot) => {
        setParticipants(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );

        participantsLoaded = true;

        if (participantsLoaded && recordsLoaded) {
          setLoading(false);
        }
      },
      (err) => {
        console.error(err);
        setError("Unable to load participants. Check Firebase settings.");
        setLoading(false);
      }
    );

    const unsubscribeRecords = onSnapshot(
      recordsQuery,
      (snapshot) => {
        setRecords(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );

        recordsLoaded = true;

        if (participantsLoaded && recordsLoaded) {
          setLoading(false);
        }
      },
      (err) => {
        console.error(err);
        setError("Unable to load prospecting records. Check Firebase rules.");
        setLoading(false);
      }
    );

    return () => {
      unsubscribeParticipants();
      unsubscribeRecords();
    };
  }, []);

  // ===================================================
  // 7. LEADERBOARD CALCULATIONS
  // ===================================================

  const rankedParticipants = useMemo(() => {
    const results = participants.map((person) => {
      const personRecords = records.filter(
        (record) => record.participantId === person.id
      );

      let total = 0;

      if (view === "daily") {
        total = personRecords
          .filter((record) => record.day === selectedDay)
          .reduce((sum, record) => sum + Number(record.contactCount || 0), 0);
      }

      if (view === "weekly") {
        const week = WEEKS[selectedWeek - 1];

        total = personRecords
          .filter(
            (record) =>
              record.day >= week.start && record.day <= week.end
          )
          .reduce((sum, record) => sum + Number(record.contactCount || 0), 0);
      }

      if (view === "bootcamp") {
        total = personRecords
          .reduce((sum, record) => sum + Number(record.contactCount || 0), 0);
      }

      return {
        ...person,
        total,
      };
    });

    results.sort((a, b) => b.total - a.total);

    let previousScore = null;
    let currentRank = 0;

    return results.map((person, index) => {
      if (person.total !== previousScore) {
        currentRank = index + 1;
        previousScore = person.total;
      }

      return {
        ...person,
        rank: currentRank,
      };
    });
  }, [participants, records, view, selectedDay, selectedWeek]);

  const topThree = rankedParticipants.slice(0, 3);

  const totalContacts = records.reduce(
    (sum, record) => sum + Number(record.contactCount || 0),
    0
  );

  const leaderboardTitle =
    view === "daily"
      ? `Day ${selectedDay} Rankings`
      : view === "weekly"
        ? WEEKS[selectedWeek - 1].label
        : "Overall Bootcamp Rankings";

  // ===================================================
  // 8. FORM HANDLING
  // ===================================================

  const updateForm = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const openSubmission = () => {
    setShowModal(true);
    setSuccess("");
    setFormError("");
  };

  const closeSubmission = () => {
    if (submitting) return;

    setShowModal(false);
    setFormError("");
    setSuccess("");

    setForm({
      day: String(Math.min(30, Math.max(1, currentDay))),
      name: "",
      pin: "",
      confirmPin: "",
      contacts: "",
    });
  };

  const submitProspecting = async (event) => {
    event.preventDefault();

    setFormError("");
    setSuccess("");

    const name = form.name.trim();
    const pin = form.pin.trim();
    const day = Number(form.day);
    const contacts = Number(form.contacts);

    if (!name) {
      return setFormError("Please enter your full name.");
    }

    if (!/^\d{4}$/.test(pin)) {
      return setFormError("Your PIN must contain exactly four digits.");
    }

    if (mode === "first" && pin !== form.confirmPin) {
      return setFormError("Your PIN confirmation does not match.");
    }

    if (
      form.contacts === "" ||
      !Number.isInteger(contacts) ||
      contacts < 0
    ) {
      return setFormError("Enter a valid whole number of contacts.");
    }

    if (!Number.isInteger(day) || day < 1 || day > 30) {
      return setFormError("Please select a valid bootcamp day.");
    }

    if (status !== "LIVE") {
      return setFormError(
        "Prospecting submissions are only available during the bootcamp."
      );
    }

    setSubmitting(true);

    try {
      const normalizedName = name.toLowerCase().replace(/\s+/g, " ");
      const pinHash = await hashPin(pin);

      const participantsQuery = query(
        collection(db, "participants"),
        where("bootcampId", "==", BOOTCAMP_ID),
        where("normalizedName", "==", normalizedName)
      );

      const existingParticipants = await getDocs(participantsQuery);

      let participantId;

      if (mode === "first") {
        if (!existingParticipants.empty) {
          throw new Error(
            "This name is already registered. Please use the returning participant option."
          );
        }

        const participantRef = doc(collection(db, "participants"));

        participantId = participantRef.id;

        const recordId = `${participantId}_day_${day}`;
        const recordRef = doc(db, "daily_records", recordId);

        await runTransaction(db, async (transaction) => {
          transaction.set(participantRef, {
            bootcampId: BOOTCAMP_ID,
            fullName: name,
            normalizedName,
            pinHash,
            createdAt: serverTimestamp(),
          });

          transaction.set(recordRef, {
            bootcampId: BOOTCAMP_ID,
            participantId,
            day,
            contactCount: contacts,
            submittedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });

      } else {
        if (existingParticipants.empty) {
          throw new Error(
            "Participant not found. Check your name or register first."
          );
        }

        if (existingParticipants.size > 1) {
          throw new Error(
            "Multiple matching names found. Please contact the administrator."
          );
        }

        const participant = existingParticipants.docs[0];
        const participantData = participant.data();

        if (participantData.pinHash !== pinHash) {
          throw new Error("Incorrect PIN. Please try again.");
        }

        participantId = participant.id;

        const recordId = `${participantId}_day_${day}`;
        const recordRef = doc(db, "daily_records", recordId);

        await runTransaction(db, async (transaction) => {
          transaction.set(
            recordRef,
            {
              bootcampId: BOOTCAMP_ID,
              participantId,
              day,
              contactCount: contacts,
              submittedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        });
      }

      setSuccess(
        mode === "first"
          ? "Your registration and daily contacts have been saved!"
          : "Your daily prospecting data has been updated successfully!"
      );

      setForm({
        day: String(day),
        name: "",
        pin: "",
        confirmPin: "",
        contacts: "",
      });

      setTimeout(() => {
        setShowModal(false);
        setSuccess("");
      }, 2200);

    } catch (err) {
      console.error(err);
      setFormError(
        err.message || "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ===================================================
  // 9. SMALL REUSABLE UI ELEMENTS
  // ===================================================

  const switchView = (newView) => {
    setView(newView);
  };

  const getViewLabel = () => {
    if (view === "daily") return "Daily";
    if (view === "weekly") return "Weekly";
    return "Bootcamp";
  };

  const PodiumCard = ({ person, position }) => {
    const colors = {
      1: "border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30",
      2: "border-slate-300 bg-slate-50 dark:bg-slate-800/50",
      3: "border-orange-300 bg-orange-50 dark:bg-orange-950/20",
    };

    const medals = {
      1: "🥇",
      2: "🥈",
      3: "🥉",
    };

    return (
      <div
        className={`relative flex min-w-0 flex-col items-center rounded-2xl border p-3 text-center ${colors[position]} ${position === 1 ? "mb-5 -mt-5 shadow-lg" : "mt-2"
          }`}
      >
        <span className="mb-2 text-3xl">{medals[position]}</span>

        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-800 shadow-sm">
          {getInitials(person.fullName)}
        </div>

        <p className="mt-2 w-full truncate text-sm font-bold text-slate-900 dark:text-white">
          {person.fullName}
        </p>

        <p className="mt-1 text-xl font-black text-slate-900 dark:text-white">
          {formatNumber(person.total)}
        </p>

        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Contacts
        </p>
      </div>
    );
  };

  const dailyQuote = getDailyQuote();

  // ===================================================
  // 10. MAIN UI
  // ===================================================

  return (
    <div className="min-h-screen bg-[#f5f7f5] text-slate-900 dark:bg-[#101714] dark:text-white">

      <div className="mx-auto max-w-6xl px-4 pb-12 pt-5 sm:px-6 lg:px-8">

        {/* HEADER */}

        <header className="mb-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0A3D33] text-xl font-black text-white">
              A
            </div>

            <div>
              <h1 className="text-lg font-black tracking-tight">
                ASCEND TEAM
              </h1>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                30-Day Prospecting Bootcamp
              </p>
            </div>
          </div>

          <span className={`rounded-full px-3 py-1.5 text-[10px] font-bold tracking-wider ${status === "LIVE"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-slate-200 text-slate-600"
            }`}>
            {status}
          </span>
        </header>

        {/* INTRODUCTION */}

        <section className="mb-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
            30 DAYS. ONE MISSION.
          </p>

          <h2 className="max-w-2xl text-3xl font-black leading-tight tracking-tight sm:text-5xl">
            Consistency Creates{" "}
            <span className="text-emerald-700 dark:text-emerald-400">
              Results.
            </span>
          </h2>

          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            Every contact counts. Stay consistent, track your
            progress and climb the Ascend Team leaderboard.
          </p>
        </section>

        {/* OVERVIEW STATS */}

        <section className="mb-10 grid grid-cols-3 gap-2 sm:gap-4">
          {[
            {
              label: "Bootcamp Day",
              value: status === "UPCOMING" ? "—" : status === "COMPLETED" ? "30/30" : `${currentDay}/30`,
              icon: CalendarDays,
            },
            {
              label: "Participants",
              value: participants.length,
              icon: Users,
            },
            {
              label: "Team Contacts",
              value: formatNumber(totalContacts),
              icon: Target,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-white/5 sm:p-5"
            >
              <stat.icon className="mb-3 h-5 w-5 text-emerald-700 dark:text-emerald-400" />

              <p className="text-lg font-black sm:text-2xl">
                {stat.value}
              </p>

              <p className="mt-1 text-[10px] font-medium text-slate-500 sm:text-xs">
                {stat.label}
              </p>
            </div>
          ))}
        </section>

        {/* LEADERBOARD */}

        <section className="mb-12" id="leaderboard">

          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
                THE RACE IS ON
              </p>

              <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
                Leaderboard
              </h2>
            </div>

            <div className="text-right">
              <p className="text-xs font-bold">{getViewLabel()}</p>
              <p className="text-[10px] text-slate-500">
                {leaderboardTitle}
              </p>
            </div>
          </div>

          {/* VIEW NAVIGATION */}

          <div className="mb-6 flex gap-1 rounded-xl bg-slate-200/70 p-1 dark:bg-white/5">
            {["daily", "weekly", "bootcamp"].map((item) => (
              <button
                key={item}
                onClick={() => switchView(item)}
                className={`flex-1 rounded-lg px-2 py-3 text-[11px] font-bold uppercase tracking-wider transition sm:text-xs ${view === item
                    ? "bg-[#0A3D33] text-white shadow-md"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
              >
                {item}
              </button>
            ))}
          </div>

          {/* PERIOD SELECTORS */}

          {view === "daily" && (
            <div className="mb-5">
              <label className="mb-2 block text-xs font-bold text-slate-500">
                SELECT BOOTCAMP DAY
              </label>

              <div className="flex gap-2 overflow-x-auto pb-2">
                {DAYS.map((day) => (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`min-w-11 rounded-lg px-3 py-2 text-xs font-bold ${selectedDay === day
                        ? "bg-[#0A3D33] text-white"
                        : "bg-white text-slate-600 dark:bg-white/5 dark:text-slate-300"
                      }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}

          {view === "weekly" && (
            <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
              {WEEKS.map((week, index) => (
                <button
                  key={week.label}
                  onClick={() => setSelectedWeek(index + 1)}
                  className={`shrink-0 rounded-xl px-4 py-3 text-xs font-bold ${selectedWeek === index + 1
                      ? "bg-[#0A3D33] text-white"
                      : "bg-white text-slate-600 dark:bg-white/5 dark:text-slate-300"
                    }`}
                >
                  {week.label}
                  <span className="mt-1 block text-[9px] font-normal opacity-70">
                    Days {week.start}–{week.end}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* PODIUM */}

          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 pt-8 shadow-sm dark:border-white/10 dark:bg-white/5 sm:p-7 sm:pt-10">
            <div className="mb-6 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <h3 className="text-sm font-black uppercase tracking-wider">
                Top Prospectors
              </h3>
            </div>

            {loading ? (
              <div className="flex justify-center py-10">
                <LoaderCircle className="h-7 w-7 animate-spin text-emerald-600" />
              </div>
            ) : rankedParticipants.length === 0 ? (
              <div className="py-10 text-center">
                <Trophy className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                <p className="font-bold">The race starts here.</p>
                <p className="mt-1 text-xs text-slate-500">
                  Participants will appear once they register.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 items-end gap-2 sm:gap-5">
                {topThree[1] && (
                  <PodiumCard person={topThree[1]} position={2} />
                )}

                {topThree[0] && (
                  <PodiumCard person={topThree[0]} position={1} />
                )}

                {topThree[2] && (
                  <PodiumCard person={topThree[2]} position={3} />
                )}
              </div>
            )}
          </div>

          {/* COMPLETE TABLE */}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">

            <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-white/10 sm:p-5">
              <div>
                <h3 className="font-black">Complete Rankings</h3>
                <p className="mt-1 text-[10px] text-slate-500">
                  {leaderboardTitle} · All participants
                </p>
              </div>

              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                {rankedParticipants.length} Members
              </span>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <LoaderCircle className="h-6 w-6 animate-spin text-emerald-600" />
              </div>
            ) : rankedParticipants.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">
                No participants registered yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[360px] text-left">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-white/5">
                      <th className="px-4 py-4">Rank</th>
                      <th className="px-4 py-4">Participant</th>
                      <th className="px-4 py-4 text-right">Contacts</th>
                    </tr>
                  </thead>

                  <tbody>
                    {rankedParticipants.map((person) => (
                      <tr
                        key={person.id}
                        className="border-t border-slate-100 transition hover:bg-emerald-50/50 dark:border-white/5 dark:hover:bg-white/5"
                      >
                        <td className="px-4 py-4">
                          <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black ${person.rank === 1
                              ? "bg-yellow-100 text-yellow-700"
                              : person.rank === 2
                                ? "bg-slate-200 text-slate-700"
                                : person.rank === 3
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300"
                            }`}>
                            {person.rank}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                              {getInitials(person.fullName)}
                            </div>

                            <span className="text-xs font-bold sm:text-sm">
                              {person.fullName}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-4 text-right">
                          <span className="text-sm font-black">
                            {formatNumber(person.total)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </section>

        {/* DAILY MOTIVATION */}

        <section className="mb-10">
          <div className="mb-4 flex items-center gap-2">
            <Quote className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
            <h2 className="text-xl font-black">Daily Motivation</h2>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-[#0A3D33] p-6 text-white sm:p-8">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full border-[25px] border-white/5" />

            <div className="relative z-10">
              <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.2em]">
                Today's Motivation
              </span>

              <p className="mt-5 max-w-2xl text-xl font-bold leading-relaxed sm:text-2xl">
                "{dailyQuote.text}"
              </p>

              <div className="mt-5">
                <p className="text-sm font-bold">{dailyQuote.author}</p>
                <p className="mt-1 text-[10px] text-white/60">
                  Source: {dailyQuote.source}
                </p>
              </div>

              <p className="mt-6 text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-200">
                ASCEND TEAM · {getLagosDate()}
              </p>
            </div>
          </div>
        </section>

        {/* ADD CONTACTS BUTTON */}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm dark:border-white/10 dark:bg-white/5 sm:p-8">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
            <TrendingUp className="h-6 w-6" />
          </div>

          <h2 className="text-xl font-black">Your Progress Matters.</h2>

          <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-500">
            Every day is an opportunity to improve. Record your
            prospecting numbers and keep climbing.
          </p>

          <button
            onClick={openSubmission}
            disabled={status !== "LIVE"}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0A3D33] px-6 py-4 text-sm font-bold text-white transition hover:bg-[#125849] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            <Plus className="h-5 w-5" />
            ADD DAILY PROSPECTING DATA
          </button>
        </section>

        <footer className="mt-10 border-t border-slate-200 pt-6 text-center dark:border-white/10">
          <p className="text-[10px] font-bold tracking-wider text-slate-400">
            ASCEND TEAM · 30-DAY PROSPECTING BOOTCAMP
          </p>
          <p className="mt-2 text-[10px] text-slate-400">
            Every contact counts. Every day matters.
          </p>
        </footer>

      </div>

      {/* =================================================
          SUBMISSION MODAL
      ================================================= */}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-sm sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeSubmission();
            }
          }}
        >
          <div className="my-auto w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#17211d]">

            {/* MODAL HEADER */}

            <div className="flex items-center justify-between bg-[#0A3D33] p-5 text-white">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-200">
                  ASCEND TEAM
                </p>
                <h2 className="mt-1 text-xl font-black">
                  Record Your Progress
                </h2>
              </div>

              <button
                onClick={closeSubmission}
                className="rounded-full bg-white/10 p-2 hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6">

              {success ? (
                <div className="py-10 text-center">
                  <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-emerald-600" />
                  <h3 className="text-lg font-black">Successfully Saved!</h3>
                  <p className="mt-2 text-sm text-slate-500">
                    {success}
                  </p>
                </div>
              ) : (
                <>
                  {/* MODE SWITCH */}

                  <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-white/5">
                    <button
                      onClick={() => {
                        setMode("returning");
                        setFormError("");
                      }}
                      className={`rounded-lg py-3 text-xs font-bold ${mode === "returning"
                          ? "bg-white text-[#0A3D33] shadow-sm dark:bg-white/10 dark:text-white"
                          : "text-slate-500"
                        }`}
                    >
                      Returning Member
                    </button>

                    <button
                      onClick={() => {
                        setMode("first");
                        setFormError("");
                      }}
                      className={`rounded-lg py-3 text-xs font-bold ${mode === "first"
                          ? "bg-white text-[#0A3D33] shadow-sm dark:bg-white/10 dark:text-white"
                          : "text-slate-500"
                        }`}
                    >
                      First Time
                    </button>
                  </div>

                  <form onSubmit={submitProspecting} className="space-y-4">

                    {/* DAY */}

                    <div>
                      <label className="mb-2 block text-xs font-bold">
                        Select Bootcamp Day
                      </label>

                      <select
                        value={form.day}
                        onChange={(e) => updateForm("day", e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-600 dark:border-white/10 dark:bg-white/5"
                      >
                        {DAYS.map((day) => (
                          <option key={day} className="text-black" value={day}>
                            Day {day}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* NAME */}

                    <div>
                      <label className="mb-2 block text-xs font-bold">
                        Full Name
                      </label>

                      <input
                        required
                        value={form.name}
                        onChange={(e) => updateForm("name", e.target.value)}
                        placeholder="Enter your full name"
                        autoComplete="name"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-600 dark:border-white/10 dark:bg-white/5"
                      />
                    </div>

                    {/* PIN */}

                    <div>
                      <label className="mb-2 flex items-center gap-2 text-xs font-bold">
                        <LockKeyhole className="h-4 w-4" />
                        Four-Digit PIN
                      </label>

                      <input
                        required
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        pattern="[0-9]{4}"
                        value={form.pin}
                        onChange={(e) =>
                          updateForm("pin", e.target.value.replace(/\D/g, "").slice(0, 4))
                        }
                        placeholder="Enter your 4-digit PIN"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm tracking-[0.4em] outline-none focus:border-emerald-600 dark:border-white/10 dark:bg-white/5"
                      />

                      {mode === "first" && (
                        <>
                          <p className="mt-2 text-[10px] leading-5 text-amber-700 dark:text-amber-400">
                            Create a PIN you will remember. You will
                            need it whenever you submit your numbers.
                            Keep it private.
                          </p>

                          <label className="mb-2 mt-4 block text-xs font-bold">
                            Confirm Four-Digit PIN
                          </label>

                          <input
                            required
                            type="password"
                            inputMode="numeric"
                            maxLength={4}
                            pattern="[0-9]{4}"
                            value={form.confirmPin}
                            onChange={(e) =>
                              updateForm(
                                "confirmPin",
                                e.target.value.replace(/\D/g, "").slice(0, 4)
                              )
                            }
                            placeholder="Confirm your PIN"
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm tracking-[0.4em] outline-none focus:border-emerald-600 dark:border-white/10 dark:bg-white/5"
                          />
                        </>
                      )}
                    </div>

                    {/* CONTACT COUNT */}

                    <div>
                      <label className="mb-2 block text-xs font-bold">
                        How Many New Contacts Did You Gather?
                      </label>

                      <input
                        required
                        type="number"
                        min="0"
                        step="1"
                        value={form.contacts}
                        onChange={(e) => updateForm("contacts", e.target.value)}
                        placeholder="e.g. 40"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-4 text-2xl font-black outline-none focus:border-emerald-600 dark:border-white/10 dark:bg-white/5"
                      />

                      <p className="mt-2 text-[10px] text-slate-500">
                        Only enter the number of contacts. No names
                        or phone numbers are required.
                      </p>
                    </div>

                    {/* UPDATE NOTICE */}

                    <div className="rounded-xl bg-emerald-50 p-3 text-[10px] leading-5 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
                      If you submit again for a day you have already
                      recorded, your previous number will be replaced
                      with the new number. It will not be added twice.
                    </div>

                    {/* ERROR */}

                    {formError && (
                      <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
                        {formError}
                      </div>
                    )}

                    {/* SUBMIT */}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0A3D33] px-5 py-4 text-sm font-bold text-white transition hover:bg-[#125849] disabled:opacity-60"
                    >
                      {submitting ? (
                        <>
                          <LoaderCircle className="h-5 w-5 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "SUBMIT PROSPECTING DATA"
                      )}
                    </button>

                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-4 left-4 right-4 z-[60] mx-auto max-w-md rounded-xl bg-red-600 p-4 text-sm font-medium text-white shadow-xl">
          {error}
        </div>
      )}

    </div>
  );
}

