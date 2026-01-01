"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, CheckCircle, MessageCircle } from "lucide-react";
import { Lead } from "@/lib/supabase";

interface BulkSMSDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLeads: Lead[];
  userId: string;
}

const TEMPLATE_VARIABLES = [
  { key: "{name}", description: "First and last name" },
  { key: "{firstName}", description: "First name only" },
  { key: "{lastName}", description: "Last name only" },
  { key: "{company}", description: "Company name" },
  { key: "{title}", description: "Job title" },
  { key: "{phone}", description: "Phone number" },
];

export function BulkSMSDialog({
  isOpen,
  onClose,
  selectedLeads,
  userId,
}: BulkSMSDialogProps) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [senderName, setSenderName] = useState<string>(
    (process.env.NEXT_PUBLIC_SMS_SENDER_NAME as string) || ""
  );
  const [isLoading, setIsLoading] = useState(false);

  const isValidSenderName = (name: string) => {
    if (!name) return true; // empty allowed (uses default)
    const trimmed = name.trim();
    // Allow letters, numbers and spaces, 3-11 characters (common sender ID limits)
    return /^[A-Za-z0-9 ]{3,11}$/.test(trimmed);
  };
  const [sendingState, setSendingState] = useState<"idle" | "sending" | "success">("idle");
  const [sendResult, setSendResult] = useState<{
    sent: number;
    failed: number;
    total: number;
    failures?: { lead_id?: string; phone?: string; name?: string; error?: string }[];
  } | null>(null);

  const handleInsertVariable = (variable: string) => {
    const textarea = document.getElementById(
      "sms-message-textarea"
    ) as HTMLTextAreaElement;
    if (textarea) {
      const cursorPos = textarea.selectionStart || message.length;
      const newMessage =
        message.slice(0, cursorPos) +
        variable +
        message.slice(cursorPos);
      setMessage(newMessage);
    }
  };

  const handleSendSMS = async () => {
    if (!message.trim()) {
      toast({
        title: "Error",
        description: "Please enter a message",
        variant: "destructive",
      });
      return;
    }

    // Validate sender name if provided
    if (senderName && !isValidSenderName(senderName)) {
      toast({
        title: "Invalid Sender",
        description: "Sender name must be 3–11 characters, letters/numbers/spaces only.",
        variant: "destructive",
      });
      return;
    }

    if (selectedLeads.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one lead",
        variant: "destructive",
      });
      return;
    }

    // Check if leads have phone numbers
    const leadsWithPhone = selectedLeads.filter((l) => l.phone);
    if (leadsWithPhone.length === 0) {
      toast({
        title: "Error",
        description: "Selected leads do not have phone numbers",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setSendingState("sending");

    try {
      const response = await fetch("/api/send-bulk-sms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leads: leadsWithPhone,
          message,
          userId,
          senderName: senderName || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send SMS");
      }

      setSendResult({
        sent: data.sent,
        failed: data.failed,
        total: data.total,
        failures: data.failures || [],
      });
      setSendingState("success");

      toast({
        title: "Success",
        description: `SMS sent! ${data.sent} successful${data.failed > 0 ? `, ${data.failed} failed` : ''}.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description:
          error.message || "Failed to send SMS. Please try again.",
        variant: "destructive",
      });
      setSendingState("idle");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setMessage("");
      setSendingState("idle");
      setSendResult(null);
      onClose();
    }
  };

  const leadsWithPhone = selectedLeads.filter((l) => l.phone).length;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Send Bulk SMS
          </DialogTitle>
          <DialogDescription>
            Send personalized SMS to {leadsWithPhone} selected lead
            {leadsWithPhone !== 1 ? "s" : ""} with phone numbers
          </DialogDescription>
        </DialogHeader>

        {sendingState === "success" && sendResult && (
          <div className="space-y-4">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <CheckCircle className="w-8 h-8 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-green-900">
                      SMS Sent Successfully!
                    </h3>
                    <p className="text-sm text-green-800 mt-2">
                      <span className="font-semibold">{sendResult.sent}</span>{" "}
                      SMS{sendResult.sent !== 1 ? "s" : ""} sent successfully
                      {sendResult.failed > 0 && (
                        <span>
                          {" "}
                          and{" "}
                          <span className="font-semibold text-orange-600">
                            {sendResult.failed}
                          </span>{" "}
                          failed
                        </span>
                      )}
                    </p>
                    {sendResult.failures && sendResult.failures.length > 0 && (
                      <div className="mt-3">
                        <Label className="text-sm font-medium">Failures</Label>
                        <div className="mt-2 space-y-2">
                          {sendResult.failures.map((f, idx) => (
                            <Card key={idx} className="border-orange-200 bg-orange-50">
                              <CardContent className="py-2 px-3">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <div className="font-semibold text-orange-800">
                                      {f.name || f.phone || "Unknown"}
                                    </div>
                                    <div className="text-xs text-orange-700">
                                      {f.phone}
                                    </div>
                                  </div>
                                  <div className="text-xs text-right text-orange-800">
                                    {f.error}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                Close
              </Button>
            </DialogFooter>
          </div>
        )}

        {sendingState !== "success" && (
          <div className="space-y-6">
            {/* Selected Leads Preview */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">
                Recipients ({leadsWithPhone})
              </Label>
              <div className="bg-gray-50 rounded-lg p-3 max-h-24 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {selectedLeads
                    .filter((l) => l.phone)
                    .slice(0, 10)
                    .map((lead) => (
                      <Badge key={lead.id} variant="secondary">
                        {lead.first_name || "Unknown"} ({lead.phone})
                      </Badge>
                    ))}
                  {leadsWithPhone > 10 && (
                    <Badge variant="outline">+{leadsWithPhone - 10} more</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Sender Name */}
            <div className="space-y-2">
              <Label htmlFor="sms-sender-name">Sender Name</Label>
              <Input
                id="sms-sender-name"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Sender name (registered with provider)"
                disabled={isLoading}
              />
              {!isValidSenderName(senderName) && (
                <p className="text-xs text-red-600">Sender name must be 3–11 characters; letters, numbers and spaces only.</p>
              )}
              <p className="text-xs text-gray-600">This will be shown as the sender ID. If left blank, the default configured sender will be used.</p>
            </div>

            {/* Message */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="sms-message-textarea">Message</Label>
                <span className="text-xs text-gray-500">
                  {message.length} characters
                </span>
              </div>
              <Textarea
                id="sms-message-textarea"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your SMS message here. Use {name}, {firstName}, {lastName}, {company}, {title}, or {phone} for personalization."
                disabled={isLoading}
                className="min-h-24"
              />
              <p className="text-xs text-gray-600">
                Example: &quot;Hi {"{firstName}"}, we have an opportunity for {"{company}"}. Call us at +8801XXXXXXXXX&quot;
              </p>
            </div>

            {/* Template Variables Guide */}
            <Card>
              <CardContent className="pt-6">
                <Label className="text-sm font-semibold mb-3 block">
                  Quick Insert Variables
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {TEMPLATE_VARIABLES.map((variable) => (
                    <Button
                      key={variable.key}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleInsertVariable(variable.key)}
                      disabled={isLoading}
                      className="justify-start text-xs"
                      title={variable.description}
                    >
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                        {variable.key}
                      </code>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Important Note */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Make sure you have SMS service configured with SMS_API_KEY and
                SMS_ACCOUNT_ID in environment variables.
              </AlertDescription>
            </Alert>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSendSMS}
                disabled={
                  isLoading || !message.trim() || leadsWithPhone === 0 || (senderName !== '' && !isValidSenderName(senderName))
                }
                title={senderName !== '' && !isValidSenderName(senderName) ? 'Invalid sender name' : undefined}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>Send {leadsWithPhone} SMS{leadsWithPhone !== 1 ? "s" : ""}</>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
