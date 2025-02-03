import {
  HeartPulse,
  Activity,
  Droplets,
  Heart,
  AlertCircle,
} from "lucide-react";
import HealthAnalyticsOld from "../../Functions/healthanalyticsold";

export default function DashboardContent() {
  return (
    <div className="bg-background min-h-screen">
      <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-sky-400 bg-clip-text text-transparent">
            Health Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Welcome back, John! Last login: 2 hours ago
          </p>
        </div>

        {/* Health Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
            <div className="flex items-center gap-4">
              <Heart className="w-8 h-8 text-red-500" />
              <div>
                <p className="text-muted-foreground text-sm">Heart Rate</p>
                <p className="text-2xl font-bold">
                  72 <span className="text-sm text-green-500">bpm</span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
            <div className="flex items-center gap-4">
              <Droplets className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-muted-foreground text-sm">Blood Pressure</p>
                <p className="text-2xl font-bold">
                  120/80{" "}
                  <span className="text-sm text-muted-foreground">mmHg</span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
            <div className="flex items-center gap-4">
              <Activity className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-muted-foreground text-sm">Steps Today</p>
                <p className="text-2xl font-bold">
                  8,432{" "}
                  <span className="text-sm text-muted-foreground">steps</span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
            <div className="flex items-center gap-4">
              <AlertCircle className="w-8 h-8 text-yellow-500" />
              <div>
                <p className="text-muted-foreground text-sm">Active Alerts</p>
                <p className="text-2xl font-bold">
                  2{" "}
                  <span className="text-sm text-muted-foreground">
                    notifications
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Health Analytics Section */}
        <section className="bg-card rounded-xl p-6 shadow-sm border border-border mb-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <HeartPulse className="w-8 h-8 text-primary" />
              <h2 className="text-2xl font-semibold">Health Trends</h2>
            </div>
            <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition">
              Generate Report
            </button>
          </div>
          <HealthAnalyticsOld />
        </section>

        {/* Recent Activity Section */}
        <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
          <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/20 rounded-lg">
              <div>
                <p className="font-medium">Medication Taken</p>
                <p className="text-sm text-muted-foreground">
                  Paracetamol 500mg
                </p>
              </div>
              <span className="text-sm text-muted-foreground">2 hours ago</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-muted/20 rounded-lg">
              <div>
                <p className="font-medium">Appointment Scheduled</p>
                <p className="text-sm text-muted-foreground">
                  Dr. Smith - Cardiology
                </p>
              </div>
              <span className="text-sm text-green-500">Tomorrow 10:00 AM</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
