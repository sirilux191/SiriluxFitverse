import ListAI from "./ConsultAI/ListAI";
import PastConsultations from "./ConsultAI/PastConsultations";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

const ConsultAI = () => {
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-4xl font-bold text-foreground mb-4">
        AI Consultation
      </h1>
      <p className="text-base text-gray-600 mb-6">
        Get instant health insights and consultations from our AI-powered
        system.
      </p>

      <Tabs
        defaultValue="ai-list"
        className="space-y-4"
      >
        <TabsList className="w-full">
          <TabsTrigger
            value="ai-list"
            className="w-1/2"
          >
            AI Consultants
          </TabsTrigger>
          <TabsTrigger
            value="past-consultations"
            className="w-1/2"
          >
            Past Consultations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai-list">
          <Card className="text-center">
            <CardHeader>
              <CardTitle>Available AI Consultants</CardTitle>
              <CardDescription>
                Choose an AI consultant based on your health needs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* AI List content will go here */}
              <ListAI />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="past-consultations">
          <Card className="text-center">
            <CardHeader>
              <CardTitle>Past Consultations</CardTitle>
              <CardDescription>
                Review your previous AI consultation sessions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Past consultations content will go here */}
              <PastConsultations />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConsultAI;
