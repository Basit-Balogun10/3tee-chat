import React, { useState, useRef } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { saveAs } from "file-saver";
import { format } from "date-fns";
import { toast } from "sonner";

// Enhanced sharing system with granular privacy controls
export interface ShareableContent {
    id: string;
    type: "overview" | "chart" | "dataset" | "dashboard";
    title: string;
    description?: string;
    data: any;
    chartId?: string;
    permissions: SharePermissions;
    metadata: ShareMetadata;
}

export interface SharePermissions {
    viewerAccess: "public" | "restricted" | "private";
    allowDownload: boolean;
    allowPrint: boolean;
    allowCopy: boolean;
    requiredPassword?: string;
    expirationDate?: Date;
    viewLimit?: number;
    allowedDomains?: string[];
    watermark?: boolean;
}

export interface ShareMetadata {
    createdAt: Date;
    createdBy: string;
    title: string;
    description?: string;
    tags: string[];
    version: string;
    dataSourceInfo: {
        timeRange: string;
        totalItems: number;
        lastUpdated: Date;
    };
}

export interface ShareLink {
    id: string;
    shortUrl: string;
    fullUrl: string;
    content: ShareableContent;
    permissions: SharePermissions;
    analytics: {
        views: number;
        uniqueViewers: number;
        lastViewed?: Date;
        downloadsCount: number;
        geographicData?: any[];
    };
    status: "active" | "expired" | "disabled" | "password-protected";
    createdAt: Date;
    expiresAt?: Date;
}

// Enhanced Export Options with Privacy Controls
export interface EnhancedExportOptions extends ExportOptions {
    sharing: {
        enabled: boolean;
        permissions: SharePermissions;
        customization: {
            removePersonalInfo: boolean;
            anonymizeData: boolean;
            includeWatermark: boolean;
            customBranding?: {
                logo?: string;
                companyName?: string;
                colors?: {
                    primary: string;
                    secondary: string;
                };
            };
        };
    };
    privacy: {
        dataObfuscation: {
            enabled: boolean;
            level: "light" | "medium" | "heavy";
        };
        contentFiltering: {
            excludeChats: string[];
            excludeProjects: string[];
            excludeTimeRanges: { start: Date; end: Date }[];
        };
        anonymization: {
            replaceUsernames: boolean;
            replaceTimestamps: boolean;
            generalizeMetrics: boolean;
        };
    };
}

// Export utilities for Analytics Dashboard
export interface ExportOptions {
    format: "pdf" | "png" | "csv" | "json";
    includeCharts: boolean;
    includeData: boolean;
    timeRange: string;
    quality: "low" | "medium" | "high";
}

export interface AnalyticsExportData {
    overview: any;
    chatAnalytics: any;
    messageAnalytics: any;
    projectAnalytics: any;
    libraryAnalytics: any;
    timeAnalytics: any;
    exportMetadata: {
        timestamp: number;
        timeRange: string;
        format: string;
        version: string;
    };
}

// PDF Export Service
export class AnalyticsPDFExporter {
    private doc: jsPDF;
    private currentY: number = 20;
    private pageHeight: number;
    private pageWidth: number;
    private margin: number = 20;

    constructor() {
        this.doc = new jsPDF();
        this.pageHeight = this.doc.internal.pageSize.getHeight();
        this.pageWidth = this.doc.internal.pageSize.getWidth();
    }

    async exportAnalyticsDashboard(
        data: AnalyticsExportData,
        options: ExportOptions,
        dashboardRef?: React.RefObject<HTMLElement>
    ): Promise<void> {
        try {
            toast.info("Generating PDF export...");

            // Add cover page
            this.addCoverPage(data);

            // Add summary page
            this.addSummaryPage(data);

            if (options.includeData) {
                // Add detailed data pages
                this.addDetailedDataPages(data);
            }

            if (options.includeCharts && dashboardRef?.current) {
                // Capture and add chart screenshots
                await this.addChartsFromDOM(
                    dashboardRef.current,
                    options.quality
                );
            }

            // Add footer to all pages
            this.addPageFooters();

            // Generate filename with timestamp
            const timestamp = format(new Date(), "yyyy-MM-dd_HH-mm-ss");
            const filename = `T3Chat_Analytics_${timestamp}.pdf`;

            // Save the PDF
            this.doc.save(filename);

            toast.success("Analytics exported successfully!");
        } catch (error) {
            console.error("PDF export error:", error);
            toast.error("Failed to export analytics PDF");
            throw error;
        }
    }

    private addCoverPage(data: AnalyticsExportData): void {
        // Title
        this.doc.setFontSize(28);
        this.doc.setFont("helvetica", "bold");
        this.doc.text("T3 Chat Analytics Report", this.pageWidth / 2, 60, {
            align: "center",
        });

        // Subtitle
        this.doc.setFontSize(16);
        this.doc.setFont("helvetica", "normal");
        this.doc.text(
            "Comprehensive Usage Analytics & Insights",
            this.pageWidth / 2,
            80,
            { align: "center" }
        );

        // Date range
        this.doc.setFontSize(12);
        this.doc.text(
            `Report Period: ${data.exportMetadata.timeRange}`,
            this.pageWidth / 2,
            100,
            { align: "center" }
        );
        this.doc.text(
            `Generated: ${format(new Date(data.exportMetadata.timestamp), "PPP 'at' p")}`,
            this.pageWidth / 2,
            115,
            { align: "center" }
        );

        // Key metrics overview
        this.doc.setFontSize(14);
        this.doc.setFont("helvetica", "bold");
        this.doc.text("Quick Overview", this.margin, 150);

        const metrics = [
            { label: "Total Chats", value: data.overview.totalChats },
            { label: "Total Messages", value: data.overview.totalMessages },
            { label: "Total Projects", value: data.overview.totalProjects },
            { label: "Library Items", value: data.overview.totalLibraryItems },
            { label: "Most Used Model", value: data.overview.mostUsedModel },
            {
                label: "Average Response Time",
                value: `${data.overview.averageResponseTime}s`,
            },
        ];

        this.doc.setFontSize(11);
        this.doc.setFont("helvetica", "normal");
        let y = 170;
        metrics.forEach((metric, index) => {
            if (index % 2 === 0) {
                y += 15;
            }
            const x = index % 2 === 0 ? this.margin : this.pageWidth / 2;
            this.doc.text(`${metric.label}: ${metric.value}`, x, y);
        });

        // Add decorative elements
        this.doc.setDrawColor(168, 85, 247); // Purple color
        this.doc.setLineWidth(2);
        this.doc.line(this.margin, 130, this.pageWidth - this.margin, 130);

        this.doc.addPage();
        this.currentY = this.margin;
    }

    private addSummaryPage(data: AnalyticsExportData): void {
        this.addSectionTitle("Executive Summary");

        // Chat Analytics Summary
        this.addSubsection("Chat Analytics", [
            `Total Conversations: ${data.chatAnalytics.totalChats}`,
            `Temporary Chats: ${data.chatAnalytics.temporaryChats}`,
            `Starred Chats: ${data.chatAnalytics.starredChats}`,
            `Shared Chats: ${data.chatAnalytics.sharedChats}`,
            `Most Active Day: ${data.overview.mostActiveDay}`,
            `Peak Hour: ${data.overview.mostActiveHour}:00`,
        ]);

        // Message Analytics Summary
        this.addSubsection("Message Analytics", [
            `Your Messages: ${data.messageAnalytics.userMessages}`,
            `AI Responses: ${data.messageAnalytics.assistantMessages}`,
            `Average Message Length: ${data.messageAnalytics.averageMessageLength} chars`,
            `Fastest Response: ${data.messageAnalytics.responseTimeAnalytics.fastestResponse}s`,
            `Average Response: ${data.messageAnalytics.responseTimeAnalytics.averageResponseTime}s`,
        ]);

        // Project Analytics Summary
        this.addSubsection("Project Organization", [
            `Total Projects: ${data.projectAnalytics.totalProjects}`,
            `Average Chats per Project: ${data.projectAnalytics.averageChatsPerProject.toFixed(1)}`,
            `Most Active Project: ${data.projectAnalytics.mostActiveProject?.name || "N/A"}`,
        ]);

        // Library Analytics Summary
        this.addSubsection("Content Library", [
            `Total Attachments: ${data.libraryAnalytics.attachments.total}`,
            `Code Artifacts: ${data.libraryAnalytics.artifacts.total}`,
            `Media Items: ${data.libraryAnalytics.media.total}`,
            `AI Generated Content: ${data.libraryAnalytics.media.generatedContent}`,
        ]);

        this.doc.addPage();
        this.currentY = this.margin;
    }

    private addDetailedDataPages(data: AnalyticsExportData): void {
        // Chat Analytics Details
        this.addSectionTitle("Detailed Chat Analytics");

        // Chat by Model table
        this.addTableSection("Chat Distribution by AI Model", [
            ["Model", "Count", "Percentage"],
            ...data.chatAnalytics.chatsByModel.map((model: any) => [
                model.model,
                model.count.toString(),
                `${model.percentage}%`,
            ]),
        ]);

        // Message Analytics Details
        this.addSectionTitle("Message Analytics Details");

        // Model usage in messages
        this.addTableSection("Message Distribution by Model", [
            ["Model", "Messages", "Percentage"],
            ...data.messageAnalytics.modelUsage.map((model: any) => [
                model.model,
                model.count.toString(),
                `${model.percentage}%`,
            ]),
        ]);

        // Project Analytics Details
        if (data.projectAnalytics.projectDistribution.length > 0) {
            this.addSectionTitle("Project Analytics Details");

            this.addTableSection("Project Activity Breakdown", [
                ["Project Name", "Chats", "Messages"],
                ...data.projectAnalytics.projectDistribution
                    .slice(0, 10)
                    .map((project: any) => [
                        project.projectName,
                        project.chatCount.toString(),
                        project.messageCount.toString(),
                    ]),
            ]);
        }

        // Library Analytics Details
        this.addSectionTitle("Library Content Analysis");

        // Attachments breakdown
        const attachments = data.libraryAnalytics.attachments.byType;
        this.addTableSection("Attachment Types", [
            ["Type", "Count"],
            ["Images", attachments.image.toString()],
            ["PDFs", attachments.pdf.toString()],
            ["Audio Files", attachments.audio.toString()],
            ["Video Files", attachments.video.toString()],
            ["Other Files", attachments.file.toString()],
        ]);

        // Artifacts by language
        if (data.libraryAnalytics.artifacts.byLanguage.length > 0) {
            this.addTableSection("Code Artifacts by Language", [
                ["Language", "Count"],
                ...data.libraryAnalytics.artifacts.byLanguage.map(
                    (lang: any) => [lang.language, lang.count.toString()]
                ),
            ]);
        }
    }

    private async addChartsFromDOM(
        element: HTMLElement,
        quality: string
    ): Promise<void> {
        try {
            const scale =
                quality === "high" ? 2 : quality === "medium" ? 1.5 : 1;

            // Find all chart containers
            const chartContainers = element.querySelectorAll(
                "[data-chart-container]"
            );

            for (let i = 0; i < chartContainers.length; i++) {
                const container = chartContainers[i] as HTMLElement;
                const chartTitle =
                    container.getAttribute("data-chart-title") ||
                    `Chart ${i + 1}`;

                try {
                    const canvas = await html2canvas(container, {
                        scale,
                        backgroundColor: "#1a1a2e",
                        logging: false,
                        useCORS: true,
                    });

                    // Add new page for chart
                    this.doc.addPage();
                    this.currentY = this.margin;

                    // Add chart title
                    this.doc.setFontSize(16);
                    this.doc.setFont("helvetica", "bold");
                    this.doc.text(chartTitle, this.margin, this.currentY);
                    this.currentY += 20;

                    // Calculate dimensions to fit page
                    const maxWidth = this.pageWidth - 2 * this.margin;
                    const maxHeight =
                        this.pageHeight - this.currentY - this.margin;

                    const aspectRatio = canvas.width / canvas.height;
                    let width = maxWidth;
                    let height = width / aspectRatio;

                    if (height > maxHeight) {
                        height = maxHeight;
                        width = height * aspectRatio;
                    }

                    // Add chart image
                    const imgData = canvas.toDataURL("image/png");
                    this.doc.addImage(
                        imgData,
                        "PNG",
                        this.margin,
                        this.currentY,
                        width,
                        height
                    );
                } catch (chartError) {
                    console.warn(
                        `Failed to capture chart: ${chartTitle}`,
                        chartError
                    );
                }
            }
        } catch (error) {
            console.warn("Failed to capture charts from DOM", error);
        }
    }

    private addSectionTitle(title: string): void {
        this.checkPageBreak(30);
        this.doc.setFontSize(18);
        this.doc.setFont("helvetica", "bold");
        this.doc.text(title, this.margin, this.currentY);
        this.currentY += 20;

        // Add underline
        this.doc.setDrawColor(168, 85, 247);
        this.doc.setLineWidth(1);
        this.doc.line(
            this.margin,
            this.currentY - 15,
            this.pageWidth - this.margin,
            this.currentY - 15
        );
    }

    private addSubsection(title: string, items: string[]): void {
        this.checkPageBreak(20 + items.length * 8);

        this.doc.setFontSize(14);
        this.doc.setFont("helvetica", "bold");
        this.doc.text(title, this.margin, this.currentY);
        this.currentY += 15;

        this.doc.setFontSize(11);
        this.doc.setFont("helvetica", "normal");
        items.forEach((item) => {
            this.doc.text(`• ${item}`, this.margin + 10, this.currentY);
            this.currentY += 8;
        });
        this.currentY += 10;
    }

    private addTableSection(title: string, data: string[][]): void {
        this.checkPageBreak(30 + data.length * 8);

        this.doc.setFontSize(14);
        this.doc.setFont("helvetica", "bold");
        this.doc.text(title, this.margin, this.currentY);
        this.currentY += 15;

        // Simple table implementation
        this.doc.setFontSize(10);
        const colWidth = (this.pageWidth - 2 * this.margin) / data[0].length;

        data.forEach((row, index) => {
            if (index === 0) {
                this.doc.setFont("helvetica", "bold");
            } else {
                this.doc.setFont("helvetica", "normal");
            }

            row.forEach((cell, colIndex) => {
                const x = this.margin + colIndex * colWidth;
                this.doc.text(cell, x, this.currentY);
            });

            this.currentY += 8;

            if (index === 0) {
                // Draw line under header
                this.doc.setDrawColor(200, 200, 200);
                this.doc.setLineWidth(0.5);
                this.doc.line(
                    this.margin,
                    this.currentY - 4,
                    this.pageWidth - this.margin,
                    this.currentY - 4
                );
            }
        });

        this.currentY += 15;
    }

    private checkPageBreak(requiredSpace: number): void {
        if (this.currentY + requiredSpace > this.pageHeight - this.margin) {
            this.doc.addPage();
            this.currentY = this.margin;
        }
    }

    private addPageFooters(): void {
        const pageCount = this.doc.internal.getNumberOfPages();

        for (let i = 1; i <= pageCount; i++) {
            this.doc.setPage(i);
            this.doc.setFontSize(9);
            this.doc.setFont("helvetica", "normal");
            this.doc.setTextColor(128, 128, 128);

            // Page number
            this.doc.text(
                `Page ${i} of ${pageCount}`,
                this.pageWidth - this.margin,
                this.pageHeight - 10,
                { align: "right" }
            );

            // Footer text
            this.doc.text(
                "Generated by T3 Chat Analytics",
                this.margin,
                this.pageHeight - 10
            );

            // Reset text color
            this.doc.setTextColor(0, 0, 0);
        }
    }
}

// CSV Export Service
export class AnalyticsCSVExporter {
    static exportToCSV(
        data: AnalyticsExportData,
        type: "overview" | "chats" | "messages" | "projects" | "library"
    ): void {
        try {
            let csvContent = "";
            let filename = "";

            switch (type) {
                case "overview":
                    csvContent = this.generateOverviewCSV(data);
                    filename = "analytics_overview";
                    break;
                case "chats":
                    csvContent = this.generateChatsCSV(data);
                    filename = "chat_analytics";
                    break;
                case "messages":
                    csvContent = this.generateMessagesCSV(data);
                    filename = "message_analytics";
                    break;
                case "projects":
                    csvContent = this.generateProjectsCSV(data);
                    filename = "project_analytics";
                    break;
                case "library":
                    csvContent = this.generateLibraryCSV(data);
                    filename = "library_analytics";
                    break;
            }

            const timestamp = format(new Date(), "yyyy-MM-dd_HH-mm-ss");
            const blob = new Blob([csvContent], {
                type: "text/csv;charset=utf-8;",
            });
            saveAs(blob, `${filename}_${timestamp}.csv`);

            toast.success(`${type} data exported to CSV successfully!`);
        } catch (error) {
            console.error("CSV export error:", error);
            toast.error("Failed to export CSV data");
        }
    }

    private static generateOverviewCSV(data: AnalyticsExportData): string {
        const headers = "Metric,Value\n";
        const rows = [
            `Total Chats,${data.overview.totalChats}`,
            `Total Messages,${data.overview.totalMessages}`,
            `Total Projects,${data.overview.totalProjects}`,
            `Library Items,${data.overview.totalLibraryItems}`,
            `Most Used Model,${data.overview.mostUsedModel}`,
            `Average Response Time,${data.overview.averageResponseTime}s`,
            `Most Active Day,${data.overview.mostActiveDay}`,
            `Peak Hour,${data.overview.mostActiveHour}:00`,
        ].join("\n");

        return headers + rows;
    }

    private static generateChatsCSV(data: AnalyticsExportData): string {
        const headers = "Model,Chat Count,Percentage\n";
        const rows = data.chatAnalytics.chatsByModel
            .map(
                (model: any) =>
                    `${model.model},${model.count},${model.percentage}%`
            )
            .join("\n");

        return headers + rows;
    }

    private static generateMessagesCSV(data: AnalyticsExportData): string {
        const headers = "Model,Message Count,Percentage\n";
        const rows = data.messageAnalytics.modelUsage
            .map(
                (model: any) =>
                    `${model.model},${model.count},${model.percentage}%`
            )
            .join("\n");

        return headers + rows;
    }

    private static generateProjectsCSV(data: AnalyticsExportData): string {
        const headers = "Project Name,Chat Count,Message Count\n";
        const rows = data.projectAnalytics.projectDistribution
            .map(
                (project: any) =>
                    `"${project.projectName}",${project.chatCount},${project.messageCount}`
            )
            .join("\n");

        return headers + rows;
    }

    private static generateLibraryCSV(data: AnalyticsExportData): string {
        const attachments = data.libraryAnalytics.attachments.byType;
        const artifacts = data.libraryAnalytics.artifacts.byLanguage;

        let csv = "Content Type,Category,Count\n";

        // Attachments
        csv += `Images,Attachments,${attachments.image}\n`;
        csv += `PDFs,Attachments,${attachments.pdf}\n`;
        csv += `Audio,Attachments,${attachments.audio}\n`;
        csv += `Video,Attachments,${attachments.video}\n`;
        csv += `Files,Attachments,${attachments.file}\n`;

        // Artifacts
        artifacts.forEach((artifact: any) => {
            csv += `${artifact.language},Artifacts,${artifact.count}\n`;
        });

        return csv;
    }
}

// JSON Export Service
export class AnalyticsJSONExporter {
    static exportToJSON(data: AnalyticsExportData): void {
        try {
            const jsonString = JSON.stringify(data, null, 2);
            const timestamp = format(new Date(), "yyyy-MM-dd_HH-mm-ss");
            const blob = new Blob([jsonString], { type: "application/json" });
            saveAs(blob, `analytics_data_${timestamp}.json`);

            toast.success("Analytics data exported to JSON successfully!");
        } catch (error) {
            console.error("JSON export error:", error);
            toast.error("Failed to export JSON data");
        }
    }
}

// PNG Export Service
export class AnalyticsPNGExporter {
    static async exportDashboardAsPNG(
        element: HTMLElement,
        options: { quality: "low" | "medium" | "high" } = { quality: "medium" }
    ): Promise<void> {
        try {
            toast.info("Capturing dashboard screenshot...");

            const scale =
                options.quality === "high"
                    ? 2
                    : options.quality === "medium"
                      ? 1.5
                      : 1;

            const canvas = await html2canvas(element, {
                scale,
                backgroundColor: "#1a1a2e",
                logging: false,
                useCORS: true,
                width: element.scrollWidth,
                height: element.scrollHeight,
            });

            canvas.toBlob((blob) => {
                if (blob) {
                    const timestamp = format(new Date(), "yyyy-MM-dd_HH-mm-ss");
                    saveAs(blob, `analytics_dashboard_${timestamp}.png`);
                    toast.success("Dashboard exported as PNG successfully!");
                } else {
                    throw new Error("Failed to create image blob");
                }
            }, "image/png");
        } catch (error) {
            console.error("PNG export error:", error);
            toast.error("Failed to export dashboard image");
        }
    }
}

// Granular Sharing Service
export class GranularSharingService {
    private static readonly SHARE_BASE_URL =
        import.meta.env.VITE_SHARE_BASE_URL ||
        `${window.location.origin}/shared`;

    // Create shareable content with granular controls
    static async createShareableContent(
        type: ShareableContent["type"],
        data: any,
        options: {
            title: string;
            description?: string;
            permissions: SharePermissions;
            privacy: EnhancedExportOptions["privacy"];
        }
    ): Promise<ShareableContent> {
        const processedData = await this.processDataForSharing(
            data,
            options.privacy
        );

        return {
            id: this.generateShareId(),
            type,
            title: options.title,
            description: options.description,
            data: processedData,
            permissions: options.permissions,
            metadata: {
                createdAt: new Date(),
                createdBy: "current-user", // TODO: Get from auth context
                title: options.title,
                description: options.description,
                tags: this.generateAutoTags(type, data),
                version: "2.0.0",
                dataSourceInfo: {
                    timeRange: this.extractTimeRange(data),
                    totalItems: this.countDataItems(data),
                    lastUpdated: new Date(),
                },
            },
        };
    }

    // Create shareable link with backend storage
    static async createShareLink(
        content: ShareableContent
    ): Promise<ShareLink> {
        try {
            // In a real implementation, this would call a backend API
            const shareId = this.generateShareId();
            const shortUrl = `${this.SHARE_BASE_URL}/${shareId}`;
            const fullUrl = `${shortUrl}?v=${content.metadata.version}`;

            const shareLink: ShareLink = {
                id: shareId,
                shortUrl,
                fullUrl,
                content,
                permissions: content.permissions,
                analytics: {
                    views: 0,
                    uniqueViewers: 0,
                    downloadsCount: 0,
                },
                status: content.permissions.requiredPassword
                    ? "password-protected"
                    : "active",
                createdAt: new Date(),
                expiresAt: content.permissions.expirationDate,
            };

            // TODO: Store in backend (Convex)
            await this.storeShareLink(shareLink);

            return shareLink;
        } catch (error) {
            console.error("Failed to create share link:", error);
            throw new Error("Failed to create shareable link");
        }
    }

    // Share specific chart with granular controls
    static async shareChart(
        chartId: string,
        chartData: any,
        chartElement: HTMLElement,
        options: {
            title: string;
            permissions: SharePermissions;
            privacy: EnhancedExportOptions["privacy"];
        }
    ): Promise<ShareLink> {
        try {
            // Capture chart image
            const chartImage = await this.captureChartImage(
                chartElement,
                options.permissions.watermark
            );

            const shareableContent = await this.createShareableContent(
                "chart",
                {
                    chartId,
                    data: chartData,
                    image: chartImage,
                    metadata: {
                        chartType: this.detectChartType(chartElement),
                        dimensions: {
                            width: chartElement.offsetWidth,
                            height: chartElement.offsetHeight,
                        },
                    },
                },
                options
            );

            return await this.createShareLink(shareableContent);
        } catch (error) {
            console.error("Failed to share chart:", error);
            throw new Error("Failed to share chart");
        }
    }

    // Share specific dataset with privacy controls
    static async shareDataset(
        datasetType: "chats" | "projects" | "library" | "time-analytics",
        rawData: any,
        options: {
            title: string;
            permissions: SharePermissions;
            privacy: EnhancedExportOptions["privacy"];
        }
    ): Promise<ShareLink> {
        try {
            const shareableContent = await this.createShareableContent(
                "dataset",
                {
                    type: datasetType,
                    data: rawData,
                },
                options
            );

            return await this.createShareLink(shareableContent);
        } catch (error) {
            console.error("Failed to share dataset:", error);
            throw new Error("Failed to share dataset");
        }
    }

    // Share overview/summary with customization
    static async shareOverview(
        overviewData: any,
        options: {
            title: string;
            permissions: SharePermissions;
            privacy: EnhancedExportOptions["privacy"];
            customization: {
                includedSections: string[];
                customMetrics?: any[];
            };
        }
    ): Promise<ShareLink> {
        try {
            const filteredData = this.filterOverviewData(
                overviewData,
                options.customization.includedSections
            );

            const shareableContent = await this.createShareableContent(
                "overview",
                filteredData,
                options
            );

            return await this.createShareLink(shareableContent);
        } catch (error) {
            console.error("Failed to share overview:", error);
            throw new Error("Failed to share overview");
        }
    }

    // Generate embeddable widget code
    static generateEmbedCode(
        shareLink: ShareLink,
        options: {
            width?: number;
            height?: number;
            theme?: "light" | "dark" | "auto";
            showControls?: boolean;
        } = {}
    ): string {
        const {
            width = 800,
            height = 600,
            theme = "auto",
            showControls = true,
        } = options;

        return `<iframe 
    src="${shareLink.fullUrl}/embed?theme=${theme}&controls=${showControls}"
    width="${width}"
    height="${height}"
    frameborder="0"
    allowfullscreen
    sandbox="allow-scripts allow-same-origin"
    style="border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);"
    title="${shareLink.content.title} - T3 Chat Analytics">
</iframe>`;
    }

    // Privacy-focused data processing
    private static async processDataForSharing(
        data: any,
        privacy: EnhancedExportOptions["privacy"]
    ): Promise<any> {
        let processedData = { ...data };

        if (privacy.anonymization.replaceUsernames) {
            processedData = this.anonymizeUsernames(processedData);
        }

        if (privacy.anonymization.replaceTimestamps) {
            processedData = this.anonymizeTimestamps(processedData);
        }

        if (privacy.anonymization.generalizeMetrics) {
            processedData = this.generalizeMetrics(processedData);
        }

        if (privacy.dataObfuscation.enabled) {
            processedData = this.obfuscateData(
                processedData,
                privacy.dataObfuscation.level
            );
        }

        if (privacy.contentFiltering.excludeChats.length > 0) {
            processedData = this.filterExcludedChats(
                processedData,
                privacy.contentFiltering.excludeChats
            );
        }

        return processedData;
    }

    // Data anonymization methods
    private static anonymizeUsernames(data: any): any {
        // Replace usernames with generic identifiers
        const userMap = new Map();
        let userCounter = 1;

        const anonymize = (obj: any): any => {
            if (typeof obj !== "object" || obj === null) return obj;
            if (Array.isArray(obj)) return obj.map(anonymize);

            const result = { ...obj };
            Object.keys(result).forEach((key) => {
                if (
                    key.toLowerCase().includes("user") ||
                    key.toLowerCase().includes("author")
                ) {
                    if (typeof result[key] === "string" && result[key]) {
                        if (!userMap.has(result[key])) {
                            userMap.set(result[key], `User ${userCounter++}`);
                        }
                        result[key] = userMap.get(result[key]);
                    }
                } else if (typeof result[key] === "object") {
                    result[key] = anonymize(result[key]);
                }
            });
            return result;
        };

        return anonymize(data);
    }

    private static anonymizeTimestamps(data: any): any {
        // Convert absolute timestamps to relative times
        const baseTime = Date.now();

        const anonymize = (obj: any): any => {
            if (typeof obj !== "object" || obj === null) return obj;
            if (Array.isArray(obj)) return obj.map(anonymize);

            const result = { ...obj };
            Object.keys(result).forEach((key) => {
                if (
                    key.toLowerCase().includes("time") ||
                    key.toLowerCase().includes("date") ||
                    key === "timestamp"
                ) {
                    if (typeof result[key] === "number") {
                        const daysDiff = Math.floor(
                            (baseTime - result[key]) / (1000 * 60 * 60 * 24)
                        );
                        result[key] = `${daysDiff} days ago`;
                    }
                } else if (typeof result[key] === "object") {
                    result[key] = anonymize(result[key]);
                }
            });
            return result;
        };

        return anonymize(data);
    }

    private static generalizeMetrics(data: any): any {
        // Round numbers to ranges for privacy
        const generalize = (obj: any): any => {
            if (typeof obj !== "object" || obj === null) return obj;
            if (Array.isArray(obj)) return obj.map(generalize);

            const result = { ...obj };
            Object.keys(result).forEach((key) => {
                if (
                    typeof result[key] === "number" &&
                    key.toLowerCase().includes("count")
                ) {
                    const value = result[key];
                    if (value < 10) result[key] = "< 10";
                    else if (value < 50) result[key] = "10-50";
                    else if (value < 100) result[key] = "50-100";
                    else if (value < 500) result[key] = "100-500";
                    else result[key] = "500+";
                } else if (typeof result[key] === "object") {
                    result[key] = generalize(result[key]);
                }
            });
            return result;
        };

        return generalize(data);
    }

    private static obfuscateData(
        data: any,
        level: "light" | "medium" | "heavy"
    ): any {
        // Apply different levels of data obfuscation
        const obfuscationLevels = {
            light: 0.1, // 10% noise
            medium: 0.25, // 25% noise
            heavy: 0.5, // 50% noise
        };

        const noiseLevel = obfuscationLevels[level];

        const obfuscate = (obj: any): any => {
            if (typeof obj !== "object" || obj === null) return obj;
            if (Array.isArray(obj)) return obj.map(obfuscate);

            const result = { ...obj };
            Object.keys(result).forEach((key) => {
                if (
                    typeof result[key] === "number" &&
                    key.toLowerCase().includes("count")
                ) {
                    const noise = (Math.random() - 0.5) * 2 * noiseLevel;
                    result[key] = Math.max(
                        0,
                        Math.round(result[key] * (1 + noise))
                    );
                } else if (typeof result[key] === "object") {
                    result[key] = obfuscate(result[key]);
                }
            });
            return result;
        };

        return obfuscate(data);
    }

    // Utility methods
    private static async captureChartImage(
        element: HTMLElement,
        includeWatermark: boolean = false
    ): Promise<string> {
        try {
            const canvas = await html2canvas(element, {
                backgroundColor: "#1a1a2e",
                scale: 2,
                logging: false,
                useCORS: true,
            });

            if (includeWatermark) {
                const ctx = canvas.getContext("2d");
                if (ctx) {
                    ctx.globalAlpha = 0.1;
                    ctx.font = "16px Arial";
                    ctx.fillStyle = "#ffffff";
                    ctx.fillText(
                        "T3 Chat Analytics",
                        canvas.width - 200,
                        canvas.height - 20
                    );
                }
            }

            return canvas.toDataURL("image/png");
        } catch (error) {
            console.error("Failed to capture chart image:", error);
            throw new Error("Failed to capture chart");
        }
    }

    private static generateShareId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private static generateAutoTags(type: string, data: any): string[] {
        const tags = [type];

        if (data.exportInfo?.timeRange)
            tags.push(`period-${data.exportInfo.timeRange}`);
        if (data.exportInfo?.totalChats)
            tags.push(`chats-${data.exportInfo.totalChats}`);
        if (data.exportInfo?.branchCount > 0)
            tags.push("branched-conversations");

        return tags;
    }

    private static extractTimeRange(data: any): string {
        return data.exportInfo?.timeRange || "unknown";
    }

    private static countDataItems(data: any): number {
        return data.exportInfo?.totalChats || data.chats?.length || 0;
    }

    private static detectChartType(element: HTMLElement): string {
        const classList = element.className;
        if (classList.includes("line-chart")) return "line";
        if (classList.includes("bar-chart")) return "bar";
        if (classList.includes("pie-chart")) return "pie";
        if (classList.includes("area-chart")) return "area";
        if (classList.includes("heatmap")) return "heatmap";
        return "unknown";
    }

    private static filterOverviewData(
        data: any,
        includedSections: string[]
    ): any {
        const filtered = { ...data };

        // Only include specified sections
        Object.keys(filtered).forEach((key) => {
            if (!includedSections.includes(key) && key !== "exportInfo") {
                delete filtered[key];
            }
        });

        return filtered;
    }

    private static filterExcludedChats(
        data: any,
        excludedChatIds: string[]
    ): any {
        const filtered = { ...data };

        if (filtered.chats) {
            filtered.chats = filtered.chats.filter(
                (chat: any) => !excludedChatIds.includes(chat.id)
            );
        }

        return filtered;
    }

    // Backend integration methods (to be implemented with Convex)
    private static async storeShareLink(shareLink: ShareLink): Promise<void> {
        // TODO: Implement Convex mutation to store share link
        console.log("Storing share link:", shareLink.id);
    }

    // Viewer analytics tracking
    static async trackView(
        shareId: string,
        viewerInfo: {
            userAgent?: string;
            ipAddress?: string;
            referrer?: string;
        }
    ): Promise<void> {
        // TODO: Implement view tracking
        console.log("Tracking view for share:", shareId);
    }

    // Share link management
    static async updateShareLink(
        shareId: string,
        updates: Partial<ShareLink>
    ): Promise<void> {
        // TODO: Implement share link updates
        console.log("Updating share link:", shareId);
    }

    static async deleteShareLink(shareId: string): Promise<void> {
        // TODO: Implement share link deletion
        console.log("Deleting share link:", shareId);
    }

    static async getShareLinkAnalytics(
        shareId: string
    ): Promise<ShareLink["analytics"]> {
        // TODO: Implement analytics retrieval
        return {
            views: 0,
            uniqueViewers: 0,
            downloadsCount: 0,
        };
    }
}
