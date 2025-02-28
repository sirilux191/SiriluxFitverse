import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CarouselItem,
  CarouselContent,
  Carousel,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Clock,
  Users,
  FileText,
  Activity,
  Award,
  Loader2,
} from "lucide-react";
import useActorStore from "../../State/Actors/ActorStore";

export default function DashboardContent() {
  const { professional } = useActorStore();
  const [professionalInfo, setProfessionalInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProfessionalInfo();
  }, []);

  const fetchProfessionalInfo = async () => {
    try {
      const result = await professional.getProfessionalInfo();
      if (result.ok) {
        const { IDNum, UUID, MetaData } = result.ok;
        const { DemographicInformation, OccupationInformation } = MetaData;

        const parsedDemoInfo = JSON.parse(
          new TextDecoder().decode(DemographicInformation)
        );
        const parsedOccupationInfo = JSON.parse(
          new TextDecoder().decode(OccupationInformation)
        );

        setProfessionalInfo({
          id: IDNum,
          uuid: UUID,
          name: parsedDemoInfo.name,
          occupation: parsedOccupationInfo.occupation,
          company: parsedOccupationInfo.company,
        });
      }
    } catch (error) {
      console.error("Error fetching professional info:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-foreground">Dashboard</h1>
          <div className="flex items-center space-x-2">
            <Button variant="outline">
              <Calendar className="mr-2 h-4 w-4" />
              View Calendar
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Total Patients
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                +0% from last month
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Upcoming Appointments
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                Next: No appointments
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Records Shared
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                +0% from last month
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Rating</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">N/A</div>
              <p className="text-xs text-muted-foreground">
                Based on 0 reviews
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Professional Information</CardTitle>
              <CardDescription>Your registered details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="font-medium">ID:</span> {professionalInfo?.id}
              </div>
              <div>
                <span className="font-medium">Name:</span>{" "}
                {professionalInfo?.name}
              </div>
              <div>
                <span className="font-medium">Occupation:</span>{" "}
                {professionalInfo?.occupation}
              </div>
              <div>
                <span className="font-medium">Company:</span>{" "}
                {professionalInfo?.company}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your latest interactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                <Activity className="mr-2 h-4 w-4" />
                No recent activity
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
