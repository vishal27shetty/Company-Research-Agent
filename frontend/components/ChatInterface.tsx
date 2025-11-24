"use client"

import React, { useState, useRef, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { motion, AnimatePresence } from "framer-motion"
import { gsap } from "gsap"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowUp, RefreshCw, BookOpen, ShieldAlert, Search, Bot, AlertTriangle, ArrowRight, PanelRightClose, PanelRightOpen, Layout } from "lucide-react"
import { cn } from "@/lib/utils"
import { ReportCanvas } from "./ReportCanvas"

interface Message {
    id?: string
    role: "user" | "assistant"
    content: string | any
    type?: "text" | "status" | "warning" | "error" | "citations" | "conflict" | "report" | "report_ready"
    displayContent?: string
    citations?: string[]
}

// Small inline magnifying glass animation component
function SmallMagnifyingGlass({ text }: { text?: string }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-2 text-muted-foreground self-center"
        >
            <motion.div
                animate={{
                    rotate: [0, 10, -10, 0],
                    scale: [1, 1.1, 1],
                }}
                transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
                className="relative"
            >
                <Search className="w-4 h-4 text-primary" />
                <motion.div
                    className="absolute inset-0 flex items-center justify-center"
                    animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.5, 0, 0.5],
                    }}
                    transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                >
                    <div className="w-1 h-1 bg-primary rounded-full" />
                </motion.div>
            </motion.div>
            {text && (
                <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs font-mono"
                >
                    {text}
                </motion.span>
            )}
        </motion.div>
    )
}

// Animated waiting state component
function AnimatedWaitingState({ text, icon: Icon }: { text: string; icon?: React.ElementType }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 text-sm text-muted-foreground self-center"
        >
            {Icon && (
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        rotate: [0, 5, -5, 0],
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                >
                    <Icon className="w-4 h-4 text-primary" />
                </motion.div>
            )}
            <motion.span
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
                className="font-mono text-xs"
            >
                {text}
            </motion.span>
        </motion.div>
    )
}

// Rotating links component - shows 3 at a time
function RotatingLinks({ links }: { links: string[] }) {
    const [visibleIndex, setVisibleIndex] = useState(0)

    useEffect(() => {
        if (links.length <= 3) return

        const interval = setInterval(() => {
            setVisibleIndex((prev) => (prev + 3) % links.length)
        }, 2000)

        return () => clearInterval(interval)
    }, [links.length])

    const visibleLinks = links.length <= 3
        ? links
        : [
            ...links.slice(visibleIndex, Math.min(visibleIndex + 3, links.length)),
            ...links.slice(0, Math.max(0, visibleIndex + 3 - links.length))
        ].slice(0, 3)

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="my-2 max-w-full"
        >
            <Card className="p-4 bg-muted/30 border-muted max-w-full overflow-hidden">
                <div className="flex items-center gap-2 font-semibold mb-3 text-muted-foreground">
                    <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    >
                        <BookOpen className="h-4 w-4 text-primary" />
                    </motion.div>
                    <span className="text-xs">Sources & Citations</span>
                    {links.length > 3 && (
                        <Badge variant="outline" className="ml-auto text-xs">
                            {visibleIndex + 1}-{Math.min(visibleIndex + 3, links.length)} of {links.length}
                        </Badge>
                    )}
                </div>
                <ul className="space-y-2 text-xs text-muted-foreground max-w-full">
                    {visibleLinks.map((link, i) => (
                        <motion.li
                            key={`${visibleIndex}-${i}`}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="flex items-start gap-2 max-w-full overflow-hidden"
                        >
                            <span className="text-primary mt-1 shrink-0">•</span>
                            <span className="break-all flex-1 min-w-0 text-xs leading-relaxed">{link}</span>
                        </motion.li>
                    ))}
                </ul>
            </Card>
        </motion.div>
    )
}

// Follow-up Questions component
function FollowUpQuestions({ content, onQuestionClick }: { content: string; onQuestionClick: (question: string) => void }) {
    // Parse markdown to extract follow-up questions
    const questions: string[] = []
    const lines = content.split('\n')
    let inFollowUpSection = false

    for (const line of lines) {
        if (line.includes('### Suggested Follow-up Questions')) {
            inFollowUpSection = true
            continue
        }
        if (inFollowUpSection && line.trim().startsWith('-')) {
            const question = line.trim().substring(1).trim()
            if (question) questions.push(question)
        }
        if (inFollowUpSection && line.trim().startsWith('#') && !line.includes('Suggested Follow-up Questions')) {
            break
        }
    }

    if (questions.length === 0) return null

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 space-y-2"
        >
            <div className="text-xs font-semibold text-muted-foreground mb-2">Related questions:</div>
            <div className="flex flex-col gap-2">
                {questions.map((question, idx) => (
                    <motion.button
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        onClick={() => onQuestionClick(question)}
                        className="group flex items-center gap-2 p-3 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 hover:border-primary/50 transition-all text-left text-sm"
                    >
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                        <span className="text-muted-foreground group-hover:text-foreground transition-colors">{question}</span>
                    </motion.button>
                ))}
            </div>
        </motion.div>
    )
}

export function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [threadId, setThreadId] = useState<string>("")
    const [isResearching, setIsResearching] = useState(false)
    const [isStreamingReport, setIsStreamingReport] = useState(false)
    const [waitingState, setWaitingState] = useState<string | null>(null)
    const [currentReport, setCurrentReport] = useState<string>("")
    const [isCanvasOpen, setIsCanvasOpen] = useState(true)

    const scrollAreaRef = useRef<HTMLDivElement>(null)
    const headerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        setThreadId(Math.random().toString(36).substring(7))
    }, [])

    // GSAP animation for header
    useEffect(() => {
        if (headerRef.current) {
            gsap.from(headerRef.current, {
                y: -20,
                opacity: 0,
                duration: 0.6,
                ease: "power2.out"
            })
        }
    }, [])

    const handleNewResearch = () => {
        setMessages([])
        setInput("")
        setCurrentReport("")
        setThreadId(Math.random().toString(36).substring(7))
    }

    const handleSubmit = async (e?: React.FormEvent, overrideInput?: string) => {
        if (e) e.preventDefault()
        const msgToSend = overrideInput || input
        if (!msgToSend.trim() || isLoading) return

        if (!overrideInput) setInput("")
        setMessages(prev => [...prev, { role: "user", content: msgToSend }])
        setIsLoading(true)
        setIsResearching(true)
        setWaitingState(null) // Don't show "Starting research..." text initially

        // Don't auto-open canvas
        // if (!isCanvasOpen) setIsCanvasOpen(true)

        try {
            const response = await fetch("http://localhost:8000/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: msgToSend,
                    thread_id: "thread_1"
                })
            })

            if (!response.ok) throw new Error("Network response was not ok")
            if (!response.body) throw new Error("No response body")

            const reader = response.body.getReader()
            const decoder = new TextDecoder()

            if (!reader) return

            let reportBuffer = ""
            let citations: string[] = []

            while (true) {
                const { value, done } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value, { stream: true })
                const lines = chunk.split("\n")

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        try {
                            const data = JSON.parse(line.slice(6))

                            if (data.type === "status") {
                                setWaitingState(data.content)
                            } else if (data.type === "citations") {
                                setMessages(prev => [...prev, {
                                    role: "assistant",
                                    content: data.content,
                                    type: "citations"
                                }])
                            } else if (data.type === "report") {
                                // Update Report Canvas with the full report
                                const content = typeof data.content === 'string' ? data.content : JSON.stringify(data.content)
                                setCurrentReport(content)
                                setIsStreamingReport(true)
                                setIsResearching(false)

                                // Add notification that report is ready (Always show this in chat history)
                                setMessages(prev => [...prev, {
                                    role: "assistant",
                                    content: "Report generated! Click below to view.",
                                    type: "report_ready"
                                }])
                            } else if (data.type === "text") {
                                // Text responses go to chat
                                const content = typeof data.content === 'string' ? data.content : JSON.stringify(data.content)
                                setMessages(prev => [...prev, {
                                    role: "assistant",
                                    content: content,
                                    type: "text"
                                }])
                                setIsResearching(false)
                            } else if (data.type === "warning") {
                                const statusText = String(data.content || "")
                                if (statusText.toLowerCase().includes("conflict") || statusText.toLowerCase().includes("detect")) {
                                    setWaitingState("Detecting conflicts")
                                } else {
                                    setWaitingState(statusText)
                                }
                            } else if (data.type === "conflict") {
                                setWaitingState(null)
                                setIsLoading(false)
                                setIsResearching(false)
                                setMessages(prev => [...prev, {
                                    role: "assistant",
                                    content: {
                                        status: data.status || data.content?.status || "CLEAN",
                                        reason: data.reason || data.content?.reason || "No reason provided"
                                    },
                                    type: "conflict"
                                }])
                            } else if (data.type === "error") {
                                setMessages(prev => [...prev, {
                                    role: "assistant",
                                    content: data.content || "An error occurred",
                                    type: "error"
                                }])
                                setIsResearching(false)
                            }
                        } catch (e) {
                            console.error("Error parsing SSE data", e)
                        }
                    }
                }
            }
        } catch (error) {
            setMessages(prev => [...prev, { role: "assistant", content: "Error: Failed to connect to agent.", type: "error" }])
            setIsResearching(false)
            setIsStreamingReport(false)
            setWaitingState(null)
        } finally {
            setIsLoading(false)
            setWaitingState(null)
            setTimeout(() => setIsStreamingReport(false), 500)
        }
    }

    useEffect(() => {
        if (scrollAreaRef.current) {
            const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight
            }
        }
    }, [messages, waitingState])

    return (
        <div className="flex h-full flex-col relative overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-muted/20 pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),transparent_50%)] pointer-events-none" />

            {/* Header - Enhanced Glassmorphism */}
            <motion.div
                ref={headerRef}
                className="relative z-20 flex h-16 items-center justify-between px-6 border-b border-white/10 bg-black/20 backdrop-blur-xl shadow-2xl shrink-0"
                style={{
                    background: 'linear-gradient(to bottom, rgba(20,20,20,0.8), rgba(20,20,20,0.6))',
                    backdropFilter: 'blur(24px) saturate(200%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(200%)',
                    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)'
                }}
            >
                <div className="flex items-center gap-3">
                    <Layout className="h-5 w-5 text-primary" />
                    <div>
                        <h1 className="font-bold text-lg font-mono bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                            Research Assistant
                        </h1>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsCanvasOpen(!isCanvasOpen)}
                        className="h-9 w-9 hover:bg-muted/50 hidden md:flex"
                        title={isCanvasOpen ? "Close Report View" : "Open Report View"}
                    >
                        {isCanvasOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleNewResearch}
                        className="h-9 w-9 hover:bg-muted/50"
                        disabled={isLoading}
                        title="New Research"
                    >
                        <RefreshCw className={cn("h-4 w-4 transition-transform", isLoading && "animate-spin")} />
                    </Button>
                </div>
            </motion.div>

            {/* Main Content Area - Full Screen Toggle */}
            <div className="flex-1 flex overflow-hidden relative z-10">
                {/* Chat Window - Full Screen */}
                <div
                    className={cn(
                        "flex flex-col h-full w-full max-w-6xl mx-auto px-4",
                        isCanvasOpen && "hidden"
                    )}
                >
                    <ScrollArea ref={scrollAreaRef} className="flex-1">
                        <div className="space-y-6 pb-32 pt-4 px-2 max-w-full overflow-hidden">
                            {/* Welcome Message - Only show when no messages */}
                            {messages.length === 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    className="flex flex-col items-center justify-center min-h-[60vh] space-y-8"
                                >
                                    {/* Welcome Text */}
                                    <div className="text-center space-y-3">
                                        <h2 className="text-2xl font-mono text-muted-foreground">
                                            Welcome to Company Research Agent
                                        </h2>
                                        <p className="text-sm font-mono text-muted-foreground/70">
                                            AI-powered research assistant for comprehensive company intelligence
                                        </p>
                                    </div>

                                    {/* Suggested Prompts */}
                                    <div className="w-full max-w-2xl space-y-3">
                                        <p className="text-xs font-mono text-muted-foreground/60 text-center mb-4">
                                            Try these prompts:
                                        </p>
                                        <div className="grid gap-3">
                                            {[
                                                "Research Apple Inc",
                                                "Analyze Tesla's financial performance",
                                                "What's the latest news about Microsoft?",
                                                "Compare Google and Meta's market position"
                                            ].map((prompt, idx) => (
                                                <motion.button
                                                    key={idx}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: 0.1 + idx * 0.1 }}
                                                    onClick={() => {
                                                        setInput(prompt)
                                                        // Auto-submit after a brief moment
                                                        setTimeout(() => handleSubmit(undefined, prompt), 100)
                                                    }}
                                                    className="group text-left px-4 py-3 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 hover:border-primary/50 transition-all font-mono text-sm text-muted-foreground hover:text-foreground"
                                                >
                                                    <span className="opacity-50 mr-2">→</span>
                                                    {prompt}
                                                </motion.button>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* Chat Messages */}
                            {messages.map((msg, idx) => (
                                <motion.div
                                    key={`msg-${idx}-${msg.type || 'text'}`}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: Math.min(idx * 0.05, 0.3) }}
                                    className={cn("flex gap-4", msg.role === "user" ? "justify-end" : "justify-start items-start")}
                                >
                                    {msg.role === "assistant" && (
                                        <Avatar className="h-8 w-8 border border-border shrink-0">
                                            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10">
                                                <Bot className="h-4 w-4 text-primary" />
                                            </AvatarFallback>
                                        </Avatar>
                                    )}

                                    <div className={cn("flex flex-col gap-2 max-w-full w-full", msg.role === "user" && "items-end")}>
                                        {msg.role === "user" && (
                                            <div className="bg-primary text-primary-foreground rounded-2xl px-4 py-2.5 text-sm shadow-sm">
                                                {msg.content}
                                            </div>
                                        )}

                                        {msg.role === "assistant" && (
                                            <div className="space-y-2 w-full">
                                                {msg.citations && msg.citations.length > 0 && (
                                                    <RotatingLinks links={msg.citations} />
                                                )}
                                                {msg.type === "citations" && Array.isArray(msg.content) && (
                                                    <RotatingLinks links={msg.content} />
                                                )}

                                                {msg.type === "conflict" && msg.content && typeof msg.content === "object" && (
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.95 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        className={cn(
                                                            "rounded-xl border p-4 text-sm shadow-sm max-w-full overflow-hidden",
                                                            msg.content.status === "CONFLICT"
                                                                ? "bg-red-950/30 border-red-900/50"
                                                                : "bg-green-950/30 border-green-900/50"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-2 font-semibold mb-2">
                                                            <span className={cn(
                                                                "text-xs",
                                                                msg.content.status === "CONFLICT" ? "text-red-400" : "text-green-400"
                                                            )}>
                                                                {msg.content.status === "CONFLICT" ? "⚠️ Conflict Detected" : "✓ Data Verification Passed"}
                                                            </span>
                                                        </div>
                                                        {msg.content.reason && (
                                                            <p className="text-muted-foreground text-xs mb-3 leading-relaxed break-words">{msg.content.reason}</p>
                                                        )}
                                                        {msg.content.status === "CONFLICT" && (
                                                            <div className="flex flex-wrap gap-2 mt-2">
                                                                <Button
                                                                    size="sm"
                                                                    variant="destructive"
                                                                    onClick={(e) => {
                                                                        e.preventDefault()
                                                                        handleSubmit(undefined, "Yes, resolve the conflict.")
                                                                    }}
                                                                    disabled={isLoading}
                                                                    className="flex-1 h-8 text-xs min-w-[80px]"
                                                                >
                                                                    Resolve
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={(e) => {
                                                                        e.preventDefault()
                                                                        handleSubmit(undefined, "Ignore conflict and proceed.")
                                                                    }}
                                                                    disabled={isLoading}
                                                                    className="flex-1 h-8 text-xs min-w-[80px]"
                                                                >
                                                                    Ignore
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </motion.div>
                                                )}

                                                {/* Only show simple text responses in chat, reports go to canvas */}
                                                {msg.type === "text" && (
                                                    <div className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 p-4 shadow-sm text-sm max-w-full overflow-hidden">
                                                        <div className="prose prose-invert prose-sm max-w-none pl-2 break-words">
                                                            <ReactMarkdown>
                                                                {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}
                                                            </ReactMarkdown>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Report Ready Notification */}
                                                {msg.type === "report_ready" && (
                                                    <div className="bg-green-950/30 border border-green-900/50 rounded-2xl p-4 shadow-sm text-sm max-w-full overflow-hidden">
                                                        <p className="text-green-400 mb-3 text-xs break-words">{msg.content}</p>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="w-full gap-2 border-green-900/50 hover:bg-green-950/50 text-xs"
                                                            onClick={() => setIsCanvasOpen(true)}
                                                        >
                                                            <PanelRightOpen className="h-4 w-4" />
                                                            Open Report Canvas
                                                        </Button>
                                                    </div>
                                                )}

                                                {msg.type === "error" && (
                                                    <Alert variant="destructive" className="rounded-xl">
                                                        <AlertTriangle className="h-4 w-4" />
                                                        <AlertDescription className="text-sm">
                                                            {msg.content}
                                                        </AlertDescription>
                                                    </Alert>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}

                            <AnimatePresence mode="wait">
                                {isResearching && !waitingState && (
                                    <motion.div
                                        key="researching"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="flex items-center gap-4"
                                    >
                                        <Avatar className="h-8 w-8 border border-border shrink-0">
                                            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10">
                                                <Bot className="h-4 w-4 text-primary" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <SmallMagnifyingGlass />
                                    </motion.div>
                                )}
                                {waitingState && (
                                    <motion.div
                                        key={`waiting-${waitingState}`}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="flex items-center gap-4"
                                    >
                                        <Avatar className="h-8 w-8 border border-border shrink-0">
                                            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10">
                                                <Bot className="h-4 w-4 text-primary" />
                                            </AvatarFallback>
                                        </Avatar>
                                        {waitingState.toLowerCase().includes("conflict") ? (
                                            <AnimatedWaitingState text={waitingState} icon={ShieldAlert} />
                                        ) : (
                                            <>
                                                <SmallMagnifyingGlass />
                                                <AnimatedWaitingState text={waitingState} />
                                            </>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </ScrollArea>

                    {/* Input Area */}
                    <div className="p-4 border-t border-border/30 bg-background/30 backdrop-blur-2xl shrink-0">
                        <form onSubmit={(e) => handleSubmit(e)}>
                            <div className="relative flex items-center">
                                <Input
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Research a company..."
                                    className="flex-1 h-12 pr-14 bg-background/50 border-border/50 focus:border-primary/50 rounded-xl"
                                    disabled={isLoading || isResearching || isStreamingReport}
                                />
                                <Button
                                    type="submit"
                                    size="icon"
                                    disabled={isLoading || isResearching || isStreamingReport || !input.trim()}
                                    className="absolute right-2 h-8 w-8 rounded-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ArrowUp className="h-4 w-4" />
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Report Canvas - Full Screen */}
                {isCanvasOpen && (
                    <div className="flex flex-col h-full w-full">
                        <ReportCanvas content={currentReport} isStreaming={isStreamingReport} />
                    </div>
                )}
            </div>
        </div>
    )
}
