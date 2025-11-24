"use client"

import React, { useRef, useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { motion } from "framer-motion"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { FileText, Download, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ReportCanvasProps {
    content: string
    isStreaming: boolean
}

export function ReportCanvas({ content, isStreaming }: ReportCanvasProps) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const [copied, setCopied] = useState(false)

    // Auto-scroll to bottom when streaming
    useEffect(() => {
        if (isStreaming && scrollRef.current) {
            const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]')
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight
            }
        }
    }, [content, isStreaming])

    const handleCopy = () => {
        navigator.clipboard.writeText(content)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleDownload = () => {
        const blob = new Blob([content], { type: "text/markdown" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "research-report.md"
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    if (!content) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center border-l border-border/50 bg-muted/5">
                <div className="bg-muted/30 p-4 rounded-full mb-4">
                    <FileText className="h-8 w-8 opacity-50" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Report Generated</h3>
                <p className="text-sm max-w-xs">
                    Start a research task to see the live report generated here.
                </p>
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col border-l border-border/50 bg-background/50 backdrop-blur-sm">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/30 bg-background/50 backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">Research Report</span>
                    {isStreaming && (
                        <span className="flex h-2 w-2 relative ml-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={handleCopy} className="h-8 w-8">
                        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleDownload} className="h-8 w-8">
                        <Download className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Content */}
            <ScrollArea ref={scrollRef} className="flex-1 p-6">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="prose prose-invert prose-sm max-w-none pb-20"
                >
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            h1: ({ node, ...props }) => <h1 className="text-3xl font-bold mt-8 mb-6 text-primary border-b border-border/30 pb-4" {...props} />,
                            h2: ({ node, ...props }) => <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground" {...props} />,
                            h3: ({ node, ...props }) => <h3 className="text-xl font-semibold mt-6 mb-3 text-foreground/90" {...props} />,
                            p: ({ node, ...props }) => <p className="mb-4 leading-relaxed text-muted-foreground" {...props} />,
                            ul: ({ node, ...props }) => <ul className="list-disc pl-10 mb-4 space-y-1" {...props} />,
                            ol: ({ node, ...props }) => <ol className="list-decimal pl-10 mb-4 space-y-1" {...props} />,
                            li: ({ node, ...props }) => <li className="text-muted-foreground" {...props} />,
                            blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-primary/30 pl-4 italic text-muted-foreground my-4" {...props} />,
                            code: ({ node, ...props }) => <code className="bg-muted/50 rounded px-1.5 py-0.5 font-mono text-sm" {...props} />,
                            pre: ({ node, ...props }) => <pre className="bg-muted/50 rounded-lg p-4 overflow-x-auto my-4" {...props} />,
                            table: ({ node, ...props }) => <div className="overflow-x-auto my-6"><table className="w-full border-collapse" {...props} /></div>,
                            th: ({ node, ...props }) => <th className="border border-border/50 px-4 py-2 bg-muted/30 text-left font-semibold" {...props} />,
                            td: ({ node, ...props }) => <td className="border border-border/50 px-4 py-2" {...props} />,
                        }}
                    >
                        {content}
                    </ReactMarkdown>
                    {isStreaming && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="inline-block w-2 h-5 bg-primary ml-1 align-middle"
                        />
                    )}
                </motion.div>
            </ScrollArea>
        </div>
    )
}
