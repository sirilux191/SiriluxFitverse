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
import { Bot } from "lucide-react";
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
        className="space-y-16 sm:space-y-6"
      >
        <TabsList className="w-full grid grid-cols-1 sm:grid-cols-2 bg-transparent p-1 gap-2">
          <TabsTrigger
            value="ai-list"
            className="px-3 py-2 rounded-md bg-muted data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
          >
            <Bot className="mr-2 h-4 w-4 hidden sm:inline-block" />
            AI Consultants
          </TabsTrigger>
          <TabsTrigger
            value="past-consultations"
            className="px-3 py-2 rounded-md bg-muted data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
          >
            Past Consultations
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="ai-list"
          className="mt-4"
        >
          <Card className="text-center">
            <CardHeader>
              <CardTitle></CardTitle>
            </CardHeader>
            <CardContent>
              {/* AI List content will go here */}
              <ListAI />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="past-consultations"
          className="mt-4"
        >
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
