/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { mapCSVToLead, parseCSV, normalizeEmail } from "@/lib/csv-utils";
import { useToast } from "@/hooks/use-toast";

export default function AddLeadPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [sources, setSources] = useState<string[]>([]);
  const [selectedSource, setSelectedSource] = useState("");
  const [newSource, setNewSource] = useState("");
  const [activeWorkspace, setActiveWorkspace] = useState<string>("");

  // single lead
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [website, setWebsite] = useState("");
  const [location, setLocation] = useState("");
  const [country, setCountry] = useState("");
  const [notes, setNotes] = useState("");

  // group add (dynamic rows)
  const [groupRows, setGroupRows] = useState<Array<any>>([
    {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      company: "",
      title: "",
      linkedin_url: "",
      website: "",
      location: "",
      country: "",
      notes: "",
    },
  ]);
  const [mode, setMode] = useState<"single" | "group">("single");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      const workspace = localStorage.getItem("activeWorkspace") || user.id;
      setActiveWorkspace(workspace);
      fetchSources(workspace);
    }
  }, [user]);

  useEffect(() => {
    const handleWorkspaceChange = (e: any) => {
      if (user) {
        const workspace =
          e.detail?.workspaceId ||
          localStorage.getItem("activeWorkspace") ||
          user.id;
        setActiveWorkspace(workspace);
        fetchSources(workspace);
      }
    };
    window.addEventListener("workspaceChanged", handleWorkspaceChange);
    return () =>
      window.removeEventListener("workspaceChanged", handleWorkspaceChange);
  }, [user]);

  async function fetchSources(workspaceId: string) {
    try {
      const { data } = await supabase
        .from("leads")
        .select("source_file")
        .eq("user_id", workspaceId);

      const unique = Array.from(
        new Set((data || []).map((d: any) => d.source_file).filter(Boolean))
      );
      setSources(unique as string[]);
    } catch (err) {
      // ignore
    }
  }

  function getActiveSource() {
    const sel = selectedSource === "none" ? "" : selectedSource;
    return newSource?.trim() || sel || "";
  }

  async function handleCreateSource() {
    const src = newSource.trim();
    if (!src)
      return toast({
        title: "Error",
        description: "Source cannot be empty",
        variant: "destructive",
      });
    setSelectedSource(src);
    setSources((prev) => Array.from(new Set([src, ...prev])));
    setNewSource("");
    toast({ title: "Source created", description: `Source "${src}" is ready` });
  }

  async function handleAddSingle() {
    if (!user) return;
    const workspace = localStorage.getItem("activeWorkspace") || user.id;
    const src = getActiveSource();
    if (!email || !email.trim())
      return toast({
        title: "Error",
        description: "Email is required",
        variant: "destructive",
      });

    setLoading(true);
    try {
      const lead = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: normalizeEmail(email),
        phone: phone.trim(),
        linkedin_url: linkedin.trim(),
        company: company.trim(),
        title: title.trim(),
        website: website.trim(),
        location: location.trim(),
        country: country.trim(),
        notes: notes.trim(),
        source_file: src,
        user_id: workspace,
      };

      const { error } = await supabase.from("leads").insert(lead);
      if (error) throw error;

      // audit
      try {
        await supabase.from("audit_logs").insert({
          action: "create",
          table_name: "leads",
          record_id: null,
          actor_id: user!.id,
          actor_email: user!.email,
          workspace_id: workspace,
          details: { email: lead.email },
        });
      } catch (e) {
        // ignore
      }
      toast({ title: "Added", description: "Lead added successfully" });
      // clear single form
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setCompany("");
      setTitle("");
      setLinkedin("");
      setWebsite("");
      setLocation("");
      setCountry("");
      setNotes("");
      fetchSources(workspace);
      router.push("/dashboard/leads");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to add lead",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleAddGroup() {
    if (!user) return;
    const workspace = localStorage.getItem("activeWorkspace") || user.id;
    const src = getActiveSource();
    if (groupRows.every((r) => !r.email?.trim()))
      return toast({
        title: "Error",
        description: "Group has no valid entries with email",
        variant: "destructive",
      });

    setLoading(true);
    try {
      const leadsToInsert = groupRows
        .map((r) => ({
          first_name: r.first_name?.trim() || "",
          last_name: r.last_name?.trim() || "",
          email: normalizeEmail(r.email || ""),
          phone: r.phone?.trim() || "",
          linkedin_url: r.linkedin_url?.trim() || "",
          company: r.company?.trim() || "",
          title: r.title?.trim() || "",
          website: r.website?.trim() || "",
          location: r.location?.trim() || "",
          country: r.country?.trim() || "",
          notes: r.notes?.trim() || "",
          source_file: src,
          user_id: workspace,
        }))
        .filter((l) => l.email && l.email !== "");

      if (leadsToInsert.length === 0) {
        toast({
          title: "No leads",
          description: "No valid leads with email found",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const batchSize = 200;
      let success = 0;
      let failed = 0;
      for (let i = 0; i < leadsToInsert.length; i += batchSize) {
        const batch = leadsToInsert.slice(i, i + batchSize);
        const { error } = await supabase.from("leads").insert(batch);
        if (error) {
          failed += batch.length;
        } else {
          success += batch.length;
          try {
            await supabase
              .from("audit_logs")
              .insert({
                action: "import_batch",
                table_name: "leads",
                record_id: null,
                actor_id: user!.id,
                actor_email: user!.email,
                workspace_id: workspace,
                details: { count: batch.length },
              });
          } catch (e) {}
        }
      }

      toast({
        title: "Import Complete",
        description: `Added ${success} leads, failed ${failed}`,
      });
      setGroupRows([
        {
          first_name: "",
          last_name: "",
          email: "",
          phone: "",
          company: "",
          title: "",
          linkedin_url: "",
          website: "",
          location: "",
          country: "",
          notes: "",
        },
      ]);
      fetchSources(workspace);
      router.push("/dashboard/leads");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to add group leads",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Add Lead</h1>
          <p className="text-slate-600 mt-1">
            Create single leads or add a group of leads and assign a source
          </p>
        </div>

        <div className="flex gap-2 mb-4">
          <Button
            variant={mode === "single" ? "default" : "outline"}
            onClick={() => setMode("single")}
          >
            Add single
          </Button>
          <Button
            variant={mode === "group" ? "default" : "outline"}
            onClick={() => setMode("group")}
          >
            Add group
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
          {mode === "single" && (
            <Card>
              <CardHeader>
                <CardTitle>Single Lead</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                  <Input
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                  <Input
                    placeholder="Email (required)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <Input
                    placeholder="Phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <Input
                    placeholder="Company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                  <Input
                    placeholder="Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                  <Input
                    placeholder="LinkedIn URL"
                    value={linkedin}
                    onChange={(e) => setLinkedin(e.target.value)}
                  />
                  <Input
                    placeholder="Website"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>

                <div>
                  <Input
                    placeholder="Location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>

                <div>
                  <Input
                    placeholder="Country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  />
                </div>

                <div>
                  <Textarea
                    placeholder="Notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Select
                    value={selectedSource}
                    onValueChange={setSelectedSource}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Source</SelectItem>
                      {sources.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    placeholder="Or create source"
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value)}
                  />
                  <Button onClick={handleCreateSource}>Create Source</Button>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleAddSingle} disabled={loading}>
                    Add Lead
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => router.push("/dashboard/leads")}
                  >
                    View Leads
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {mode === "group" && (
            <Card>
              <CardHeader>
                <CardTitle>Group Add</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-slate-600">
                    Enter multiple leads below. Click &quot;Add more&quot; to
                    append another row. Only rows with an Email will be
                    inserted.
                  </p>
                </div>

                <div className="space-y-2">
                  {groupRows.map((row, idx) => (
                    <div
                      key={idx}
                      className="flex gap-2 items-start lg:flex-nowrap md:flex-wrap flex-wrap"
                    >
                      <Input
                        placeholder="First Name"
                        value={row.first_name}
                        onChange={(e) =>
                          setGroupRows((prev) => {
                            const copy = [...prev];
                            copy[idx] = {
                              ...copy[idx],
                              first_name: e.target.value,
                            };
                            return copy;
                          })
                        }
                      />
                      <Input
                        placeholder="Last Name"
                        value={row.last_name}
                        onChange={(e) =>
                          setGroupRows((prev) => {
                            const copy = [...prev];
                            copy[idx] = {
                              ...copy[idx],
                              last_name: e.target.value,
                            };
                            return copy;
                          })
                        }
                      />
                      <Input
                        placeholder="Email (required)"
                        value={row.email}
                        onChange={(e) =>
                          setGroupRows((prev) => {
                            const copy = [...prev];
                            copy[idx] = { ...copy[idx], email: e.target.value };
                            return copy;
                          })
                        }
                      />
                      <Input
                        placeholder="Phone"
                        value={row.phone}
                        onChange={(e) =>
                          setGroupRows((prev) => {
                            const copy = [...prev];
                            copy[idx] = { ...copy[idx], phone: e.target.value };
                            return copy;
                          })
                        }
                      />
                      <Input
                        placeholder="Company"
                        value={row.company}
                        onChange={(e) =>
                          setGroupRows((prev) => {
                            const copy = [...prev];
                            copy[idx] = {
                              ...copy[idx],
                              company: e.target.value,
                            };
                            return copy;
                          })
                        }
                      />
                      <Input
                        placeholder="Title"
                        value={row.title}
                        onChange={(e) =>
                          setGroupRows((prev) => {
                            const copy = [...prev];
                            copy[idx] = { ...copy[idx], title: e.target.value };
                            return copy;
                          })
                        }
                      />
                      <Input
                        placeholder="LinkedIn"
                        value={row.linkedin_url}
                        onChange={(e) =>
                          setGroupRows((prev) => {
                            const copy = [...prev];
                            copy[idx] = {
                              ...copy[idx],
                              linkedin_url: e.target.value,
                            };
                            return copy;
                          })
                        }
                      />
                      <Input
                        placeholder="Website"
                        value={row.website}
                        onChange={(e) =>
                          setGroupRows((prev) => {
                            const copy = [...prev];
                            copy[idx] = {
                              ...copy[idx],
                              website: e.target.value,
                            };
                            return copy;
                          })
                        }
                      />
                      <Input
                        placeholder="Location"
                        value={row.location}
                        onChange={(e) =>
                          setGroupRows((prev) => {
                            const copy = [...prev];
                            copy[idx] = {
                              ...copy[idx],
                              location: e.target.value,
                            };
                            return copy;
                          })
                        }
                      />
                      <Input
                        placeholder="Country"
                        value={row.country}
                        onChange={(e) =>
                          setGroupRows((prev) => {
                            const copy = [...prev];
                            copy[idx] = {
                              ...copy[idx],
                              country: e.target.value,
                            };
                            return copy;
                          })
                        }
                      />
                      <Input
                        placeholder="Notes"
                        value={row.notes}
                        onChange={(e) =>
                          setGroupRows((prev) => {
                            const copy = [...prev];
                            copy[idx] = { ...copy[idx], notes: e.target.value };
                            return copy;
                          })
                        }
                      />

                      <div className="flex flex-col gap-2">
                        <Button
                          variant="outline"
                          onClick={() =>
                            setGroupRows((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-end">
                    <Button
                      onClick={() =>
                        setGroupRows((prev) => [
                          ...prev,
                          {
                            first_name: "",
                            last_name: "",
                            email: "",
                            phone: "",
                            company: "",
                            title: "",
                            linkedin_url: "",
                            website: "",
                            location: "",
                            country: "",
                            notes: "",
                          },
                        ])
                      }
                    >
                      Add more
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Select
                    value={selectedSource}
                    onValueChange={setSelectedSource}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Source</SelectItem>
                      {sources.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Or create source"
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value)}
                  />
                  <Button onClick={handleCreateSource}>Create Source</Button>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleAddGroup} disabled={loading}>
                    Add Group
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setGroupRows([
                        {
                          first_name: "",
                          last_name: "",
                          email: "",
                          phone: "",
                          company: "",
                          title: "",
                          linkedin_url: "",
                          website: "",
                          location: "",
                          country: "",
                          notes: "",
                        },
                      ]);
                    }}
                  >
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
