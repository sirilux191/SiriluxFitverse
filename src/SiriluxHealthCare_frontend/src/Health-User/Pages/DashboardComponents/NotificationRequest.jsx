import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Notifications from "../../../CommonPages/Notifications";
import Requests from "./Requests";

const NotificationRequest = ({ isOpen, onClose }) => {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={onClose}
    >
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Notifications & Requests</DialogTitle>
        </DialogHeader>
        <Tabs
          defaultValue="notifications"
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="requests">Requests</TabsTrigger>
          </TabsList>
          <TabsContent value="notifications">
            <Notifications />
          </TabsContent>
          <TabsContent value="requests">
            <Requests />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationRequest;
