"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/components/UserProvider";
import { useRouter } from "next/navigation";

interface ReportData {
  tenantName: string;
  tenantUrl: string;
  generatedAt: string;
  kpis: {
    totalUsers: number;
    activeUsers: number;
    propertyListings: number;
    totalSubmissions: number;
    photosManaged: number;
    avgPhotosPerListing: number;
  };
  statusBreakdown: {
    approved: number;
    submitted: number;
    draft: number;
  };
  adoption: {
    registeredAdvisors: number;
    activeAdvisors: number;
    noActivity: number;
    staffAccounts: number;
    adoptionPercent: number;
  };
  dailyVolume: { date: string; count: number }[];
  topUsers: { name: string; listings: number; photos: number }[];
  emailDomains: { name: string; count: number }[];
  photoDistribution: { label: string; count: number }[];
}

export default function UsageReportPage() {
  const { user } = useUser();
  const router = useRouter();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== "ADMIN") {
      router.push("/admin");
      return;
    }
    fetch("/api/admin/usage-report-data")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load report data");
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user, router]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F7F6F3",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            border: "3px solid #E5E2DC",
            borderTopColor: "#002349",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F7F6F3",
          fontFamily: "'Source Sans 3', sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#DC2626", fontSize: 18, marginBottom: 16 }}>
            {error || "Failed to load report"}
          </p>
          <button
            onClick={() => router.push("/admin")}
            style={{
              padding: "8px 20px",
              background: "#002349",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const generatedDate = new Date(data.generatedAt).toLocaleDateString(
    "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  );

  const maxPhotos = Math.max(...data.topUsers.map((u) => u.photos), 1);
  const maxVol = Math.max(...data.dailyVolume.map((d) => d.count), 1);
  const maxDist = Math.max(...data.photoDistribution.map((d) => d.count), 1);

  // Donut chart calculations
  const circumference = 2 * Math.PI * 56; // r=56
  const adoptionOffset =
    circumference - (data.adoption.adoptionPercent / 100) * circumference;

  const domainUrl = data.tenantUrl.replace(/^https?:\/\//, "");

  return (
    <>
      <style>{`
        .report-root {
          --sir-blue: #002349;
          --sir-blue-light: #003366;
          --sir-gold: #C29B40;
          --sir-gold-light: #D4B05C;
          --bg: #F7F6F3;
          --card: #FFFFFF;
          --text: #1A1A1A;
          --text-muted: #6B7280;
          --border: #E5E2DC;
          --green: #16A34A;
          --amber: #D97706;
          --red: #DC2626;
          font-family: 'Source Sans 3', sans-serif;
          background: var(--bg);
          color: var(--text);
          min-height: 100vh;
          margin: 0;
        }
        .report-root * { box-sizing: border-box; }

        .report-header {
          background: var(--sir-blue);
          color: white;
          padding: 32px 48px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .report-header h1 { font-size: 28px; font-weight: 700; letter-spacing: -0.5px; margin: 0; }
        .report-header .subtitle { font-size: 14px; opacity: 0.6; margin-top: 4px; font-weight: 300; }
        .report-header .meta { text-align: right; font-size: 13px; opacity: 0.5; line-height: 1.6; }

        .gold-bar { height: 3px; background: linear-gradient(90deg, var(--sir-gold), var(--sir-gold-light), var(--sir-gold)); }

        .report-actions {
          background: var(--bg);
          padding: 16px 48px;
          display: flex;
          gap: 12px;
          border-bottom: 1px solid var(--border);
        }
        .report-actions a, .report-actions button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 600;
          border-radius: 8px;
          text-decoration: none;
          cursor: pointer;
          border: 1px solid var(--border);
          background: var(--card);
          color: var(--text);
          font-family: inherit;
          transition: background 0.15s;
        }
        .report-actions a:hover, .report-actions button:hover { background: #F0EDE8; }

        .report-container { max-width: 1280px; margin: 0 auto; padding: 32px 48px 64px; }

        .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 32px; }
        .kpi-card {
          background: var(--card);
          border-radius: 12px;
          padding: 24px;
          border: 1px solid var(--border);
          position: relative;
          overflow: hidden;
        }
        .kpi-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: var(--sir-gold);
        }
        .kpi-label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          color: var(--text-muted);
          font-weight: 600;
          margin-bottom: 8px;
        }
        .kpi-value { font-size: 36px; font-weight: 700; color: var(--sir-blue); line-height: 1; }
        .kpi-sub { font-size: 13px; color: var(--text-muted); margin-top: 6px; }

        .section-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
        .section-grid.full { grid-template-columns: 1fr; }

        .rpt-card {
          background: var(--card);
          border-radius: 12px;
          padding: 28px;
          border: 1px solid var(--border);
        }
        .card-title {
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          color: var(--text-muted);
          font-weight: 600;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .card-title::before {
          content: '';
          width: 3px;
          height: 14px;
          background: var(--sir-gold);
          border-radius: 2px;
          display: inline-block;
          flex-shrink: 0;
        }

        .status-grid { display: flex; gap: 12px; flex-wrap: wrap; }
        .status-pill {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #F9F8F6;
          border-radius: 10px;
          padding: 14px 20px;
          flex: 1;
          min-width: 150px;
          border: 1px solid var(--border);
        }
        .status-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .status-dot.approved { background: var(--green); }
        .status-dot.submitted { background: var(--amber); }
        .status-dot.draft { background: var(--red); }
        .status-name { font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.8px; }
        .status-count { font-size: 22px; font-weight: 700; color: var(--sir-blue); }

        .adoption-row { display: flex; align-items: center; gap: 32px; }
        .donut-container { position: relative; width: 140px; height: 140px; flex-shrink: 0; }
        .donut-container svg { transform: rotate(-90deg); }
        .donut-label {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
        }
        .donut-pct { font-size: 32px; font-weight: 700; color: var(--sir-blue); line-height: 1; }
        .donut-sub { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
        .adoption-detail { flex: 1; }
        .adoption-stat {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #F0EDE8;
          font-size: 14px;
        }
        .adoption-stat:last-child { border-bottom: none; }
        .adoption-stat span:first-child { color: var(--text-muted); }
        .adoption-stat span:last-child { font-weight: 600; color: var(--sir-blue); }

        .volume-chart {
          display: flex;
          align-items: flex-end;
          gap: 6px;
          height: 160px;
          padding-top: 20px;
        }
        .vol-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; }
        .vol-bar {
          width: 100%;
          border-radius: 4px 4px 0 0;
          background: linear-gradient(180deg, var(--sir-blue), var(--sir-blue-light));
          min-height: 2px;
          position: relative;
        }
        .vol-bar:hover { opacity: 0.85; }
        .vol-bar .tooltip {
          display: none;
          position: absolute;
          top: -30px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--sir-blue);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
          z-index: 10;
        }
        .vol-bar:hover .tooltip { display: block; }
        .vol-date {
          font-size: 10px;
          color: var(--text-muted);
          writing-mode: vertical-lr;
          transform: rotate(180deg);
          height: 52px;
          text-align: right;
        }

        .data-table { width: 100%; border-collapse: collapse; }
        .data-table th {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--text-muted);
          font-weight: 600;
          text-align: left;
          padding: 0 12px 12px;
          border-bottom: 2px solid var(--border);
        }
        .data-table th:last-child, .data-table td:last-child { text-align: right; }
        .data-table td { padding: 12px; font-size: 14px; border-bottom: 1px solid #F0EDE8; }
        .data-table tr:last-child td { border-bottom: none; }

        .rank {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px; height: 24px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
        }
        .rank.gold { background: #FEF3C7; color: #92400E; }
        .rank.silver { background: #F3F4F6; color: #374151; }
        .rank.bronze { background: #FED7AA; color: #9A3412; }
        .rank.other { background: #F9FAFB; color: #6B7280; }

        .photo-bar-mini {
          display: inline-block;
          height: 6px;
          background: var(--sir-gold);
          border-radius: 3px;
          margin-right: 8px;
          vertical-align: middle;
        }

        .bar-chart { display: flex; flex-direction: column; gap: 10px; }
        .bar-row { display: grid; grid-template-columns: 100px 1fr 50px; align-items: center; gap: 12px; }
        .bar-label { font-size: 13px; color: var(--text); text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .bar-track { height: 28px; background: #F0EDE8; border-radius: 6px; overflow: hidden; }
        .bar-fill {
          height: 100%;
          border-radius: 6px;
          background: linear-gradient(90deg, var(--sir-gold), var(--sir-gold-light));
          min-width: 2px;
        }
        .bar-value { font-size: 14px; font-weight: 600; color: var(--sir-blue); text-align: right; }

        .domain-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid #F0EDE8;
        }
        .domain-row:last-child { border-bottom: none; }
        .domain-name { font-size: 14px; font-family: monospace; color: var(--sir-blue); }
        .domain-count { font-size: 14px; font-weight: 600; color: var(--text-muted); }

        .report-footer {
          text-align: center;
          padding: 24px;
          font-size: 12px;
          color: var(--text-muted);
          border-top: 1px solid var(--border);
          margin-top: 16px;
        }

        @media (max-width: 900px) {
          .kpi-row { grid-template-columns: repeat(2, 1fr); }
          .section-grid { grid-template-columns: 1fr; }
          .report-header { padding: 24px; }
          .report-container { padding: 24px; }
          .report-actions { padding: 12px 24px; }
        }

        @media print {
          .report-root { background: white; }
          .report-container { padding: 24px 0; }
          .report-actions { display: none; }
        }
      `}</style>

      <div className="report-root">
        <div className="report-header">
          <div>
            <h1>PhotoMagic Usage Report</h1>
            <p className="subtitle">{data.tenantName}</p>
          </div>
          <div className="meta">
            Generated {generatedDate}
            <br />
            {domainUrl}
          </div>
        </div>
        <div className="gold-bar" />

        <div className="report-actions">
          <a href="/admin">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              arrow_back
            </span>
            Back to Dashboard
          </a>
          <button onClick={() => window.print()}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              print
            </span>
            Print Report
          </button>
          <a href="/api/admin/usage-report" download>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              download
            </span>
            Download CSV
          </a>
        </div>

        <div className="report-container">
          {/* KPIs */}
          <div className="kpi-row">
            <div className="kpi-card">
              <div className="kpi-label">Total Users</div>
              <div className="kpi-value">
                {data.kpis.totalUsers.toLocaleString()}
              </div>
              <div className="kpi-sub">Across all domains</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Active Users</div>
              <div className="kpi-value">
                {data.kpis.activeUsers.toLocaleString()}
              </div>
              <div className="kpi-sub">With listing activity</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Property Listings</div>
              <div className="kpi-value">
                {data.kpis.propertyListings.toLocaleString()}
              </div>
              <div className="kpi-sub">
                {data.kpis.totalSubmissions.toLocaleString()} total submissions
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Photos Managed</div>
              <div className="kpi-value">
                {data.kpis.photosManaged.toLocaleString()}
              </div>
              <div className="kpi-sub">
                Avg {data.kpis.avgPhotosPerListing} per listing
              </div>
            </div>
          </div>

          {/* Status + Adoption */}
          <div className="section-grid">
            <div className="rpt-card">
              <div className="card-title">Listing Status Breakdown</div>
              <div className="status-grid">
                <div className="status-pill">
                  <div className="status-dot approved" />
                  <div>
                    <span className="status-name">Approved</span>
                    <div className="status-count">
                      {data.statusBreakdown.approved}
                    </div>
                  </div>
                </div>
                <div className="status-pill">
                  <div className="status-dot submitted" />
                  <div>
                    <span className="status-name">Submitted</span>
                    <div className="status-count">
                      {data.statusBreakdown.submitted}
                    </div>
                  </div>
                </div>
                <div className="status-pill">
                  <div className="status-dot draft" />
                  <div>
                    <span className="status-name">Draft</span>
                    <div className="status-count">
                      {data.statusBreakdown.draft}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rpt-card">
              <div className="card-title">Advisor Adoption</div>
              <div className="adoption-row">
                <div className="donut-container">
                  <svg width="140" height="140" viewBox="0 0 140 140">
                    <circle
                      cx="70"
                      cy="70"
                      r="56"
                      fill="none"
                      stroke="#F0EDE8"
                      strokeWidth="14"
                    />
                    <circle
                      cx="70"
                      cy="70"
                      r="56"
                      fill="none"
                      stroke="#002349"
                      strokeWidth="14"
                      strokeDasharray={circumference}
                      strokeDashoffset={adoptionOffset}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="donut-label">
                    <div className="donut-pct">
                      {data.adoption.adoptionPercent}%
                    </div>
                    <div className="donut-sub">adopted</div>
                  </div>
                </div>
                <div className="adoption-detail">
                  <div className="adoption-stat">
                    <span>Registered advisors</span>
                    <span>{data.adoption.registeredAdvisors}</span>
                  </div>
                  <div className="adoption-stat">
                    <span>Active (submitted listings)</span>
                    <span>{data.adoption.activeAdvisors}</span>
                  </div>
                  <div className="adoption-stat">
                    <span>No activity yet</span>
                    <span>{data.adoption.noActivity}</span>
                  </div>
                  <div className="adoption-stat">
                    <span>Staff accounts</span>
                    <span>{data.adoption.staffAccounts}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Daily Volume */}
          {data.dailyVolume.length > 0 && (
            <div className="section-grid full">
              <div className="rpt-card">
                <div className="card-title">Daily Submission Volume</div>
                <div className="volume-chart">
                  {data.dailyVolume.map((d, i) => (
                    <div className="vol-col" key={i}>
                      <div
                        className="vol-bar"
                        style={{ height: (d.count / maxVol) * 140 }}
                      >
                        <div className="tooltip">
                          {d.count} submission{d.count !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <div className="vol-date">{d.date}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Top Users + Domains */}
          <div className="section-grid">
            <div className="rpt-card">
              <div className="card-title">Top Users by Listings</div>
              {data.topUsers.length === 0 ? (
                <p style={{ color: "#6B7280", fontSize: 14 }}>
                  No listing data yet
                </p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}>#</th>
                      <th>Advisor</th>
                      <th>Listings</th>
                      <th>Photos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topUsers.map((u, i) => {
                      const rankClass =
                        i === 0
                          ? "gold"
                          : i === 1
                            ? "silver"
                            : i === 2
                              ? "bronze"
                              : "other";
                      const barW = (u.photos / maxPhotos) * 60;
                      return (
                        <tr key={i}>
                          <td>
                            <span className={`rank ${rankClass}`}>
                              {i + 1}
                            </span>
                          </td>
                          <td>{u.name}</td>
                          <td>{u.listings}</td>
                          <td>
                            <span
                              className="photo-bar-mini"
                              style={{ width: barW }}
                            />
                            {u.photos.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="rpt-card">
              <div className="card-title">Email Domains</div>
              <div>
                {data.emailDomains.map((d, i) => (
                  <div className="domain-row" key={i}>
                    <span className="domain-name">{d.name}</span>
                    <span className="domain-count">{d.count}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 20 }}>
                <div className="card-title" style={{ marginBottom: 14 }}>
                  Photo Count Distribution
                </div>
                <div className="bar-chart">
                  {data.photoDistribution.map((d, i) => {
                    const pct = (d.count / maxDist) * 100;
                    return (
                      <div className="bar-row" key={i}>
                        <span className="bar-label">{d.label} photos</span>
                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="bar-value">{d.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="report-footer">
            PhotoMagic &middot; {data.tenantName} &middot; Internal Use Only
          </div>
        </div>
      </div>
    </>
  );
}
