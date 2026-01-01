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
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, CheckCircle, Mail } from "lucide-react";
import { Lead } from "@/lib/supabase";

interface BulkEmailDialogProps {
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
  { key: "{email}", description: "Email address" },
  { key: "{phone}", description: "Phone number" },
];

export function BulkEmailDialog({
  isOpen,
  onClose,
  selectedLeads,
  userId,
}: BulkEmailDialogProps) {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [senderName, setSenderName] = useState("LeadVault");
  const [isLoading, setIsLoading] = useState(false);
  const [sendingState, setSendingState] = useState<"idle" | "sending" | "success">("idle");
  const [sendResult, setSendResult] = useState<{
    sent: number;
    failed: number;
    total: number;
    failures?: { lead_id?: string; email?: string; name?: string; error?: string; provider_response?: string }[];
    successes?: { lead_id?: string; email?: string; name?: string; sent_at?: string }[];
  } | null>(null);

  const handleInsertVariable = (variable: string) => {
    const textarea = document.getElementById(
      "message-textarea"
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

  const handleSendEmails = async () => {
    if (!subject.trim()) {
      toast({
        title: "Error",
        description: "Please enter an email subject",
        variant: "destructive",
      });
      return;
    }

    if (!message.trim()) {
      toast({
        title: "Error",
        description: "Please enter a message",
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

    setIsLoading(true);
    setSendingState("sending");

    try {
      const response = await fetch("/api/send-bulk-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leads: selectedLeads,
          subject,
          message,
          senderName,
          userId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send emails");
      }

      setSendResult({
        sent: data.sent,
        failed: data.failed,
        total: data.total,
        failures: data.failures || [],
        successes: data.successes || [],
      });
      setSendingState("success");

      toast({
        title: "Success",
        description: `Emails sent! ${data.sent} successful, ${data.failed} failed.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description:
          error.message || "Failed to send bulk emails. Please try again.",
        variant: "destructive",
      });
      setSendingState("idle");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setSubject("");
      setMessage("");
      setSenderName("LeadVault");
      setSendingState("idle");
      setSendResult(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Send Bulk Email
          </DialogTitle>
          <DialogDescription>
            Send personalized emails to {selectedLeads.length} selected lead
            {selectedLeads.length !== 1 ? "s" : ""}
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
                      Emails Sent Successfully!
                    </h3>
                    <p className="text-sm text-green-800 mt-2">
                      <span className="font-semibold">{sendResult.sent}</span>{" "}
                      email{sendResult.sent !== 1 ? "s" : ""} sent successfully
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
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <div className="font-semibold text-orange-800">{f.name || f.email || 'Unknown'}</div>
                                      <div className="text-xs text-orange-700">{f.email}</div>
                                    </div>
                                    <div className="text-xs text-right text-orange-800">{f.error}</div>
                                  </div>
                                  {f.provider_response && (
                                    <pre className="text-xs p-2 bg-white rounded border border-orange-100 overflow-auto max-h-24">{String(f.provider_response).slice(0, 1000)}</pre>
                                  )}
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
                Recipients ({selectedLeads.length})
              </Label>
              <div className="bg-gray-50 rounded-lg p-3 max-h-24 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {selectedLeads.slice(0, 10).map((lead) => (
                    <Badge key={lead.id} variant="secondary">
                      {lead.first_name || "Unknown"} {lead.last_name || ""}
                    </Badge>
                  ))}
                  {selectedLeads.length > 10 && (
                    <Badge variant="outline">
                      +{selectedLeads.length - 10} more
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Sender Name */}
            <div className="space-y-2">
              <Label htmlFor="sender-name">From (Sender Name)</Label>
              <Input
                id="sender-name"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="LeadVault"
                disabled={isLoading}
              />
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g., Partnership Opportunity"
                disabled={isLoading}
              />
            </div>

            {/* Message */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="message-textarea">Message</Label>
                <span className="text-xs text-gray-500">
                  {message.length} characters
                </span>
              </div>
              <Textarea
                id="message-textarea"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your message here. Use {name}, {firstName}, {lastName}, {company}, {title}, {email}, or {phone} for personalization."
                disabled={isLoading}
                className="min-h-32"
              />
              <p className="text-xs text-gray-600">
                Example: &quot;Hi {"{firstName}"}, I wanted to reach out regarding {"{company}"}...&quot;
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
                Make sure you have email service configured. Check your API keys
                in environment variables (RESEND_API_KEY for Resend).
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
                onClick={handleSendEmails}
                disabled={
                  isLoading ||
                  !subject.trim() ||
                  !message.trim() ||
                  selectedLeads.length === 0
                }
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>Send {selectedLeads.length} Email{selectedLeads.length !== 1 ? "s" : ""}</>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
