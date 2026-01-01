"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase, Lead } from "@/lib/supabase";
import {
  Search,
  Download,
  Filter,
  X,
  ExternalLink,
  Trash2,
  Loader2,
  Edit2,
  ChevronDown,
  Eye,
  Mail,
  MessageCircle,
} from "lucide-react";
import {
  exportToCSV,
  exportToExcel,
  exportToJSON,
  exportToPDF,
} from "@/lib/csv-utils";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BulkEmailDialog } from "@/components/bulk-email-dialog";
import { BulkSMSDialog } from "@/components/bulk-sms-dialog";

export const dynamic = "force-dynamic";

export default function LeadsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeWorkspace, setActiveWorkspace] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<string | null>(null);
  const [deleteMultipleDialogOpen, setDeleteMultipleDialogOpen] =
    useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Partial<Lead> | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingLead, setViewingLead] = useState<Lead | null>(null);
  const [companies, setCompanies] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [duplicateGroups, setDuplicateGroups] = useState<
    Array<{ email: string; ids: string[] }>
  >([]);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [workspacesList, setWorkspacesList] = useState<
    Array<{ workspace_id: string; workspace_email: string }>
  >([]);
  const [copyTarget, setCopyTarget] = useState<string>("");
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [merging, setMerging] = useState(false);
  const [bulkEmailDialogOpen, setBulkEmailDialogOpen] = useState(false);
  const [bulkSMSDialogOpen, setBulkSMSDialogOpen] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (user) {
      const workspace = localStorage.getItem("activeWorkspace") || user.id;
      setActiveWorkspace(workspace);
      fetchLeads(workspace);
      fetchAccessibleWorkspaces();
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
        fetchLeads(workspace);
      }
    };
    window.addEventListener("workspaceChanged", handleWorkspaceChange);
    return () =>
      window.removeEventListener("workspaceChanged", handleWorkspaceChange);
  }, [user]);

  useEffect(() => {
    filterLeads();
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchTerm, companyFilter, sourceFilter, countryFilter, leads]);

  async function fetchLeads(workspaceId: string) {
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("user_id", workspaceId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const leadsData = data || [];
      setLeads(leadsData);
      setFilteredLeads(leadsData);

      // compute duplicates by normalized email
      const emailMap = new Map<string, string[]>();
      for (const l of leadsData) {
        const e = (l.email || "").trim().toLowerCase();
        if (!e) continue;
        const arr = emailMap.get(e) || [];
        arr.push(l.id);
        emailMap.set(e, arr);
      }

      const groups: Array<{ email: string; ids: string[] }> = [];
      let dupCount = 0;
      for (const [email, ids] of emailMap.entries()) {
        if (ids.length > 1) {
          groups.push({ email, ids });
          dupCount += ids.length - 1; // count duplicates excluding primary
        }
      }

      setDuplicateGroups(groups);
      setDuplicateCount(dupCount);

      const uniqueCompanies = Array.from(
        new Set(data?.map((l) => l.company).filter(Boolean))
      );
      const uniqueSources = Array.from(
        new Set(data?.map((l) => l.source_file).filter(Boolean))
      );
      const uniqueCountries = Array.from(
        new Set(data?.map((l) => l.country).filter(Boolean))
      );
      setCompanies(uniqueCompanies as string[]);
      setSources(uniqueSources as string[]);
      setCountries(uniqueCountries as string[]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch leads",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function fetchAccessibleWorkspaces() {
    try {
      const own = {
        workspace_id: user!.id,
        workspace_email: user!.email || "My Workspace",
      };
      const { data } = await supabase
        .from("account_members")
        .select("workspace_id, workspace_email")
        .eq("member_user_id", user!.id);
      const shared = (data || []).map((d: any) => ({
        workspace_id: d.workspace_id,
        workspace_email: d.workspace_email || d.workspace_id,
      }));
      setWorkspacesList([own, ...shared]);
    } catch (e) {
      // ignore
    }
  }

  function filterLeads() {
    let filtered = leads;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (lead) =>
          lead.first_name?.toLowerCase().includes(term) ||
          lead.last_name?.toLowerCase().includes(term) ||
          lead.email?.toLowerCase().includes(term) ||
          lead.company?.toLowerCase().includes(term) ||
          lead.title?.toLowerCase().includes(term)
      );
    }

    if (companyFilter) {
      filtered = filtered.filter((lead) => lead.company === companyFilter);
    }

    if (sourceFilter) {
      filtered = filtered.filter((lead) => lead.source_file === sourceFilter);
    }

    if (countryFilter) {
      filtered = filtered.filter((lead) => lead.country === countryFilter);
    }

    setFilteredLeads(filtered);
  }

  function getPaginatedLeads() {
    if (itemsPerPage === -1) {
      // Show all
      return filteredLeads;
    }
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredLeads.slice(startIndex, endIndex);
  }

  function getTotalPages() {
    if (itemsPerPage === -1) {
      return 1;
    }
    return Math.ceil(filteredLeads.length / itemsPerPage);
  }

  function clearFilters() {
    setSearchTerm("");
    setCompanyFilter("");
    setSourceFilter("");
    setCountryFilter("");
  }

  async function handleExportFormat(
    format: "pdf" | "excel" | "csv" | "json",
    useSelected: boolean
  ) {
    const leadsToExport =
      useSelected && selectedLeads.length > 0
        ? filteredLeads.filter((lead) => selectedLeads.includes(lead.id))
        : filteredLeads;

    if (leadsToExport.length === 0) {
      toast({
        title: "No leads to export",
        description: "Please select leads or ensure there are leads available.",
        variant: "destructive",
      });
      return;
    }

    setExporting(true);
    try {
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `leads-export-${timestamp}`;

      switch (format) {
        case "pdf":
          await exportToPDF(leadsToExport, `${filename}.pdf`);
          break;
        case "excel":
          await exportToExcel(leadsToExport, `${filename}.xlsx`);
          break;
        case "csv":
          exportToCSV(leadsToExport, `${filename}.csv`);
          break;
        case "json":
          exportToJSON(leadsToExport, `${filename}.json`);
          break;
      }

      toast({
        title: "Export Complete",
        description: `Exported ${
          leadsToExport.length
        } leads to ${format.toUpperCase()}`,
      });
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export leads",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  }

  async function handleCopyToWorkspace() {
    if (!copyTarget)
      return toast({
        title: "Error",
        description: "Select a target workspace",
        variant: "destructive",
      });
    if (selectedLeads.length === 0)
      return toast({
        title: "Error",
        description: "Select leads to copy",
        variant: "destructive",
      });
    if (copyTarget === activeWorkspace)
      return toast({
        title: "Error",
        description:
          "Cannot copy leads to the same workspace you are currently viewing",
        variant: "destructive",
      });

    try {
      const toCopy = leads
        .filter((l) => selectedLeads.includes(l.id))
        .map((l) => ({
          ...l,
          user_id: copyTarget,
          source_file: `${l.source_file || "copied"} (copied)`,
        }));
      // remove id fields to avoid PK conflicts
      const sanitized = toCopy.map(
        ({ id, created_at, updated_at, ...rest }) => rest
      );
      const { error } = await supabase.from("leads").insert(sanitized);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        action: "copy",
        table_name: "leads",
        record_id: null,
        actor_id: user!.id,
        actor_email: user!.email,
        workspace_id: copyTarget,
        details: { count: sanitized.length, from: activeWorkspace },
      });
      toast({
        title: "Copied",
        description: `Copied ${sanitized.length} leads to workspace`,
      });
      setCopyTarget(""); // reset dropdown
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to copy leads",
        variant: "destructive",
      });
    }
  }

  function toggleLeadSelection(leadId: string) {
    setSelectedLeads((prev) =>
      prev.includes(leadId)
        ? prev.filter((id) => id !== leadId)
        : [...prev, leadId]
    );
  }

  function toggleSelectAll() {
    if (selectedLeads.length === filteredLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(filteredLeads.map((lead) => lead.id));
    }
  }

  async function handleDelete(leadId: string) {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("leads")
        .delete()
        .eq("id", leadId)
        .eq("user_id", user!.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Lead deleted successfully",
      });

      fetchLeads(activeWorkspace);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete lead",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setLeadToDelete(null);
    }
  }

  async function handleBulkDelete() {
    if (selectedLeads.length === 0) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("leads")
        .delete()
        .in("id", selectedLeads)
        .eq("user_id", user!.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Deleted ${selectedLeads.length} lead(s) successfully`,
      });

      setSelectedLeads([]);
      fetchLeads(activeWorkspace);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete selected leads",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteMultipleDialogOpen(false);
    }
  }

  async function handleMergeDuplicates() {
    if (duplicateGroups.length === 0) return;

    setMerging(true);
    try {
      for (const group of duplicateGroups) {
        // fetch full lead objects for this group
        const groupLeads = leads.filter((l) => group.ids.includes(l.id));
        if (groupLeads.length <= 1) continue;

        // choose primary lead (earliest created_at)
        const sorted = groupLeads.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const primary = sorted[0];
        const others = sorted.slice(1);
        const otherIds = others.map((o) => o.id);

        if (otherIds.length > 0) {
          // delete duplicates
          const { error: delError } = await supabase
            .from("leads")
            .delete()
            .in("id", otherIds)
            .eq("user_id", user!.id);

          if (delError) throw delError;

          // create duplicate_groups record linking to primary
          const { data: dupGroup } = await supabase
            .from("duplicate_groups")
            .insert({
              primary_lead_id: primary.id,
              match_type: "email",
              user_id: user!.id,
            })
            .select()
            .single();

          if (dupGroup && dupGroup.id) {
            // update primary lead to reference duplicate group
            await supabase
              .from("leads")
              .update({ duplicate_group_id: dupGroup.id })
              .eq("id", primary.id);
          }
        }
      }

      toast({
        title: "Merged",
        description: "Duplicate leads merged (kept one per group)",
      });
      fetchLeads(activeWorkspace);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to merge duplicates",
        variant: "destructive",
      });
    } finally {
      setMerging(false);
      setMergeDialogOpen(false);
    }
  }

  function openEditModal(lead: Lead) {
    setEditingLead({ ...lead });
    setEditDialogOpen(true);
  }

  function updateEditingLead<K extends keyof Lead>(
    key: K,
    value: Lead[K] | any
  ) {
    setEditingLead((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleUpdateLead() {
    if (!editingLead || !editingLead.id) return;

    const { id, user_id, created_at, updated_at, ...payload } =
      editingLead as any;

    try {
      const { error } = await supabase
        .from("leads")
        .update(payload)
        .eq("id", editingLead.id)
        .eq("user_id", user!.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Lead updated successfully",
      });

      fetchLeads(activeWorkspace);
      setEditDialogOpen(false);
      setEditingLead(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update lead",
        variant: "destructive",
      });
    }
  }

  return (
    <DashboardLayout>
      <div
        className={`space-y-6 transition-opacity duration-300 ${
          exporting || deleting || merging
            ? "opacity-50 pointer-events-none"
            : "opacity-100"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Leads</h1>
            <p className="text-slate-600 mt-1">
              {filteredLeads.length} of {leads.length} leads
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {selectedLeads.length != 0 && (
              <Button
                variant="destructive"
                onClick={() => setDeleteMultipleDialogOpen(true)}
                disabled={selectedLeads.length === 0 || deleting}
              >
                <Trash2
                  className={`w-4 h-4 mr-2 ${deleting ? "animate-spin" : ""}`}
                />
                {deleting
                  ? "Deleting..."
                  : `Delete Selected ${
                      selectedLeads.length > 0
                        ? `(${selectedLeads.length})`
                        : ""
                    }`}
              </Button>
            )}
            {duplicateCount > 0 && (
              <Button
                variant="outline"
                onClick={() => setMergeDialogOpen(true)}
                className="flex items-center"
                disabled={merging}
              >
                {merging ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Merging...
                  </>
                ) : (
                  <>Merge Duplicates ({duplicateCount})</>
                )}
              </Button>
            )}

            {/* Bulk Email Button */}
            {selectedLeads.length > 0 && (
              <Button
                onClick={() => setBulkEmailDialogOpen(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Mail className="w-4 h-4 mr-2" />
                Send Email ({selectedLeads.length})
              </Button>
            )}

            {/* Bulk SMS Button */}
            {selectedLeads.length > 0 && (
              <Button
                onClick={() => setBulkSMSDialogOpen(true)}
                className="bg-green-600 hover:bg-green-700"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Send SMS ({selectedLeads.length})
              </Button>
            )}

            {/* Export Selected Dropdown */}
            {selectedLeads.length != 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={selectedLeads.length === 0 || exporting}
                  >
                    {exporting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Exporting... ({selectedLeads.length})
                      </>
                    ) : (
                      <>Export Selected ({selectedLeads.length})</>
                    )}
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onClick={() => handleExportFormat("pdf", true)}
                    disabled={exporting}
                  >
                    PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleExportFormat("excel", true)}
                    disabled={exporting}
                  >
                    Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleExportFormat("csv", true)}
                    disabled={exporting}
                  >
                    CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleExportFormat("json", true)}
                    disabled={exporting}
                  >
                    JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {selectedLeads.length != 0 && (
              <div className="flex items-center">
                <Select
                  value={copyTarget}
                  onValueChange={(v: string) => setCopyTarget(v)}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Copy to workspace" />
                  </SelectTrigger>
                  <SelectContent>
                    {workspacesList
                      .filter((ws) => ws.workspace_id !== activeWorkspace) // Filter out current workspace
                      .map((ws) => (
                        <SelectItem
                          key={ws.workspace_id}
                          value={ws.workspace_id}
                        >
                          {ws.workspace_email}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  onClick={handleCopyToWorkspace}
                  disabled={
                    selectedLeads.length === 0 ||
                    !copyTarget ||
                    workspacesList.filter(
                      (ws) => ws.workspace_id !== activeWorkspace
                    ).length === 0
                  }
                  className="ml-2"
                >
                  Copy Selected
                </Button>
              </div>
            )}
            {/* Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  disabled={exporting || filteredLeads.length === 0}
                >
                  <Download
                    className={`w-4 h-4 mr-2 ${
                      exporting ? "animate-spin" : ""
                    }`}
                  />
                  {exporting ? "Exporting..." : "Export All"}
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onClick={() => handleExportFormat("pdf", false)}
                  disabled={exporting}
                >
                  PDF
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleExportFormat("excel", false)}
                  disabled={exporting}
                >
                  Excel
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleExportFormat("csv", false)}
                  disabled={exporting}
                >
                  CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleExportFormat("json", false)}
                  disabled={exporting}
                >
                  JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(value) => {
                    setItemsPerPage(parseInt(value));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-32">
                    <SelectValue placeholder="Show" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">Show 25</SelectItem>
                    <SelectItem value="50">Show 50</SelectItem>
                    <SelectItem value="100">Show 100</SelectItem>
                    <SelectItem value="-1">Show All</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search by name, email, company, or title..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={companyFilter} onValueChange={setCompanyFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem disabled value=" ">All Companies</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company} value={company}>
                        {company}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem disabled value=" ">All Sources</SelectItem>
                    {sources.map((source) => (
                      <SelectItem key={source} value={source}>
                        {source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={countryFilter} onValueChange={setCountryFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem disabled value=" ">All Countries</SelectItem>
                    {countries.map((country) => (
                      <SelectItem key={country} value={country}>
                        {country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(searchTerm ||
                  companyFilter ||
                  sourceFilter ||
                  countryFilter) && (
                  <Button variant="outline" onClick={clearFilters}>
                    <X className="w-4 h-4 mr-2" />
                    Clear
                  </Button>
                )}
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-600">No leads found</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <input
                              type="checkbox"
                              checked={
                                selectedLeads.length === filteredLeads.length
                              }
                              onChange={toggleSelectAll}
                              className="rounded"
                              disabled={deleting}
                            />
                          </TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getPaginatedLeads().map((lead) => (
                          <TableRow key={lead.id}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedLeads.includes(lead.id)}
                                onChange={() => toggleLeadSelection(lead.id)}
                                className="rounded"
                                disabled={deleting}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <span>
                                  {lead.first_name} {lead.last_name}
                                </span>
                                {(lead.is_duplicate ||
                                  duplicateGroups.some((g) =>
                                    g.ids.includes(lead.id)
                                  )) && (
                                  <Badge className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                                    Duplicate
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {lead.email}
                            </TableCell>
                            <TableCell>{lead.company || "-"}</TableCell>
                            <TableCell>{lead.title || "-"}</TableCell>
                            <TableCell>{lead.phone || "-"}</TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {lead.source_file || "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {lead.linkedin_url && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      window.open(lead.linkedin_url, "_blank")
                                    }
                                    disabled={deleting}
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setViewingLead(lead);
                                    setViewDialogOpen(true);
                                  }}
                                  disabled={deleting}
                                  title="View lead details"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditModal(lead)}
                                  disabled={deleting}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setLeadToDelete(lead.id);
                                    setDeleteDialogOpen(true);
                                  }}
                                  disabled={deleting}
                                >
                                  <Trash2
                                    className={`w-4 h-4 text-red-600 ${
                                      deleting ? "animate-spin" : ""
                                    }`}
                                  />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {itemsPerPage !== -1 && getTotalPages() > 1 && (
                    <div className="flex items-center justify-between bg-slate-50 border-t px-4 py-3">
                      <div className="text-sm text-slate-600">
                        Page {currentPage} of {getTotalPages()} | Showing {getPaginatedLeads().length} of {filteredLeads.length} leads
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(getTotalPages(), p + 1))}
                          disabled={currentPage === getTotalPages()}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overlay Loading Indicator */}
      {(exporting || deleting || merging) && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center pointer-events-none z-50">
          <div className="bg-white rounded-lg px-6 py-4 shadow-lg flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span className="font-medium text-slate-900">
              {exporting
                ? "Exporting leads..."
                : deleting
                ? "Deleting leads..."
                : merging
                ? "Merging duplicates..."
                : ""}
            </span>
          </div>
        </div>
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Lead</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this lead? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => leadToDelete && handleDelete(leadToDelete)}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteMultipleDialogOpen}
        onOpenChange={setDeleteMultipleDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {selectedLeads.length} Selected Leads
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the selected leads? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteMultipleDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleBulkDelete()}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting {selectedLeads.length}...
                </>
              ) : (
                `Delete ${selectedLeads.length}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge Duplicates</DialogTitle>
            <DialogDescription>
              Found {duplicateGroups.length} duplicate group(s) with{" "}
              {duplicateCount} duplicate lead(s). Merging will keep one lead per
              group and remove the rest.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMergeDialogOpen(false)}
              disabled={merging}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleMergeDuplicates()}
              disabled={merging}
            >
              {merging ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Merging...
                </>
              ) : (
                "Merge"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lead Details</DialogTitle>
            <DialogDescription>
              Complete information for {viewingLead?.first_name}{" "}
              {viewingLead?.last_name}
            </DialogDescription>
          </DialogHeader>
          {viewingLead && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-1">
                    First Name
                  </h4>
                  <p className="text-slate-900">
                    {viewingLead.first_name || "-"}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-1">
                    Last Name
                  </h4>
                  <p className="text-slate-900">
                    {viewingLead.last_name || "-"}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-1">
                    Email
                  </h4>
                  <p className="text-slate-900 break-all">
                    {viewingLead.email || "-"}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-1">
                    Phone
                  </h4>
                  <p className="text-slate-900">{viewingLead.phone || "-"}</p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-1">
                    Company
                  </h4>
                  <p className="text-slate-900">{viewingLead.company || "-"}</p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-1">
                    Title
                  </h4>
                  <p className="text-slate-900">{viewingLead.title || "-"}</p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-1">
                    Website
                  </h4>
                  <p className="text-slate-900 break-all">
                    {viewingLead.website || "-"}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-1">
                    Location
                  </h4>
                  <p className="text-slate-900">
                    {viewingLead.location || "-"}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-1">
                    Country
                  </h4>
                  <p className="text-slate-900">{viewingLead.country || "-"}</p>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-1">
                  LinkedIn URL
                </h4>
                <p className="text-slate-900 break-all">
                  {viewingLead.linkedin_url ? (
                    <a
                      href={viewingLead.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {viewingLead.linkedin_url}
                    </a>
                  ) : (
                    "-"
                  )}
                </p>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-1">
                  Source File
                </h4>
                <p className="text-slate-900">
                  {viewingLead.source_file || "-"}
                </p>
              </div>
              {viewingLead.notes && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-1">
                    Notes
                  </h4>
                  <p className="text-slate-900 whitespace-pre-wrap">
                    {viewingLead.notes}
                  </p>
                </div>
              )}
              {viewingLead.is_duplicate && (
                <div>
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                    Marked as Duplicate
                  </Badge>
                </div>
              )}
              <div className="text-sm text-slate-500 pt-4 border-t">
                <p>
                  Created:{" "}
                  {viewingLead.created_at
                    ? new Date(viewingLead.created_at).toLocaleString()
                    : "Unknown"}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
            <Button
              variant="default"
              onClick={() => {
                setViewDialogOpen(false);
                if (viewingLead) {
                  openEditModal(viewingLead);
                }
              }}
            >
              Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Lead</DialogTitle>
            <DialogDescription>
              Update lead details and click Save.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="First name"
                value={editingLead?.first_name || ""}
                onChange={(e) =>
                  updateEditingLead("first_name", e.target.value)
                }
              />
              <Input
                placeholder="Last name"
                value={editingLead?.last_name || ""}
                onChange={(e) => updateEditingLead("last_name", e.target.value)}
              />
              <Input
                placeholder="Email"
                value={editingLead?.email || ""}
                onChange={(e) => updateEditingLead("email", e.target.value)}
              />
              <Input
                placeholder="Phone"
                value={editingLead?.phone || ""}
                onChange={(e) => updateEditingLead("phone", e.target.value)}
              />
              <Input
                placeholder="Company"
                value={editingLead?.company || ""}
                onChange={(e) => updateEditingLead("company", e.target.value)}
              />
              <Input
                placeholder="Title"
                value={editingLead?.title || ""}
                onChange={(e) => updateEditingLead("title", e.target.value)}
              />
              <Input
                placeholder="Website"
                value={editingLead?.website || ""}
                onChange={(e) => updateEditingLead("website", e.target.value)}
              />
              <Input
                placeholder="LinkedIn URL"
                value={editingLead?.linkedin_url || ""}
                onChange={(e) =>
                  updateEditingLead("linkedin_url", e.target.value)
                }
              />
              <Input
                placeholder="Location"
                value={editingLead?.location || ""}
                onChange={(e) => updateEditingLead("location", e.target.value)}
              />
              <Input
                placeholder="Country"
                value={editingLead?.country || ""}
                onChange={(e) => updateEditingLead("country", e.target.value)}
              />
            </div>
            <div>
              <Input
                placeholder="Source file"
                value={editingLead?.source_file || ""}
                onChange={(e) =>
                  updateEditingLead("source_file", e.target.value)
                }
              />
            </div>
            <div>
              <Textarea
                placeholder="Notes"
                value={editingLead?.notes || ""}
                onChange={(e) => updateEditingLead("notes", e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!editingLead?.is_duplicate}
                  onChange={(e) =>
                    updateEditingLead("is_duplicate", e.target.checked)
                  }
                />
                <span className="text-sm">Is Duplicate</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setEditingLead(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="default" onClick={() => handleUpdateLead()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Email Dialog */}
      <BulkEmailDialog
        isOpen={bulkEmailDialogOpen}
        onClose={() => setBulkEmailDialogOpen(false)}
        selectedLeads={filteredLeads.filter((lead) =>
          selectedLeads.includes(lead.id)
        )}
        userId={user?.id || ""}
      />

      {/* Bulk SMS Dialog */}
      <BulkSMSDialog
        isOpen={bulkSMSDialogOpen}
        onClose={() => setBulkSMSDialogOpen(false)}
        selectedLeads={filteredLeads.filter((lead) =>
          selectedLeads.includes(lead.id)
        )}
        userId={user?.id || ""}
      />
    </DashboardLayout>
  );
}
