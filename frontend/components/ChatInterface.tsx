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
import { ArrowUp, RefreshCw, BookOpen, ShieldAlert, Search, Bot, AlertTriangle, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
    id?: string
    role: "user" | "assistant"
    content: string | any
    type?: "text" | "status" | "warning" | "error" | "citations" | "conflict" | "report"
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
            className="my-2"
        >
            <Card className="p-4 bg-muted/30 border-muted">
                <div className="flex items-center gap-2 font-semibold mb-3 text-muted-foreground">
                    <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    >
                        <BookOpen className="h-4 w-4 text-primary" />
                    </motion.div>
                    <span>Sources & Citations</span>
                    {links.length > 3 && (
                        <Badge variant="outline" className="ml-auto">
                            {visibleIndex + 1}-{Math.min(visibleIndex + 3, links.length)} of {links.length}
                        </Badge>
                    )}
                </div>
                <ul className="space-y-2 text-xs text-muted-foreground">
                    {visibleLinks.map((link, i) => (
                        <motion.li
                            key={`${visibleIndex}-${i}`}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="flex items-start gap-2"
                        >
                            <span className="text-primary mt-1">•</span>
                            <span className="truncate flex-1">{link}</span>
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

// Typing effect component for reports
function TypingText({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
    const [displayedText, setDisplayedText] = useState("")
    const prevLengthRef = useRef(0)
    const intervalRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        // Clear any existing interval
        if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }

        // If content was reset
        if (content.length < prevLengthRef.current) {
            setDisplayedText("")
            prevLengthRef.current = 0
            return
        }

        // If streaming stopped, show full content immediately (no animation)
        if (!isStreaming) {
            setDisplayedText(content)
            prevLengthRef.current = content.length
            return
        }

        // Only animate when streaming and content is growing
        if (content.length > prevLengthRef.current && isStreaming) {
            const startLength = prevLengthRef.current
            const newChars = content.slice(startLength)
            if (newChars.length === 0) return

            let charIndex = 0
            const targetLength = content.length

            intervalRef.current = setInterval(() => {
                // Check if content has changed (new content arrived)
                if (content.length > targetLength) {
                    // Content updated, catch up immediately
                    clearInterval(intervalRef.current!)
                    intervalRef.current = null
                    setDisplayedText(content)
                    prevLengthRef.current = content.length
                    return
                }

                // Continue typing
                if (charIndex < newChars.length) {
                    const newLength = startLength + charIndex + 1
                    setDisplayedText(content.slice(0, newLength))
                    charIndex++
                } else {
                    // Finished this batch
                    clearInterval(intervalRef.current!)
                    intervalRef.current = null
                    setDisplayedText(content)
                    prevLengthRef.current = content.length
                }
            }, 8)

            return () => {
                if (intervalRef.current) {
                    clearInterval(intervalRef.current)
                    intervalRef.current = null
                }
            }
        }
    }, [content, isStreaming])

    const showCursor = isStreaming && displayedText.length < content.length

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="prose prose-invert max-w-none mt-2"
        >
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: ({ node, ...props }) => <h1 className="text-3xl font-bold mt-6 mb-4 text-primary" {...props} />,
                    h2: ({ node, ...props }) => <h2 className="text-2xl font-bold mt-5 mb-3 border-b border-border pb-1 text-primary" {...props} />,
                    h3: ({ node, ...props }) => <h3 className="text-xl font-semibold mt-4 mb-2 text-primary" {...props} />,
                    p: ({ node, ...props }) => <p className="mb-4 leading-relaxed" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-4" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-4" {...props} />,
                    li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                    strong: ({ node, ...props }) => <strong className="font-bold text-primary" {...props} />,
                }}
            >
                {displayedText}
            </ReactMarkdown>
            {showCursor && (
                <motion.span
                    key="cursor"
                    className="inline-block w-2 h-5 bg-primary ml-1"
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                />
            )}
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
    const scrollAreaRef = useRef<HTMLDivElement>(null)
    const headerRef = useRef<HTMLDivElement>(null)
    const currentReportIndex = useRef<number>(-1)

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
        setThreadId(Math.random().toString(36).substring(7))
        currentReportIndex.current = -1
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

            let reportContent = ""
            let citations: string[] = []
            let currentMessageId: string | null = null

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
                                // Create a standalone message for citations immediately so it shows up during research
                                setMessages(prev => [...prev, {
                                    role: "assistant",
                                    content: data.content,
                                    type: "citations"
                                }])
                                // We don't update the 'citations' variable so it doesn't get attached to the report message as well
                            } else if (data.type === "report" || data.type === "text") {
                                console.log("Received report/text:", data.type, "Content length:", data.content.length)
                                const content = typeof data.content === 'string' ? data.content : JSON.stringify(data.content)
                                reportContent += content
                                setIsStreamingReport(true)

                                // Generate ID synchronously if it doesn't exist
                                if (!currentMessageId) {
                                    currentMessageId = Math.random().toString(36).substring(7)
                                    console.log("Creating NEW message with ID:", currentMessageId)

                                    setMessages(prev => [...prev, {
                                        id: currentMessageId!,
                                        role: "assistant",
                                        content: reportContent,
                                        displayContent: reportContent,
                                        type: data.type || "report",
                                        citations: citations.length > 0 ? citations : undefined
                                    }])
                                } else {
                                    // Update existing message
                                    // console.log("Updating message:", currentMessageId, "Content length:", reportContent.length)
                                    setMessages(prev => prev.map(msg =>
                                        msg.id === currentMessageId
                                            ? {
                                                ...msg,
                                                content: reportContent,
                                                displayContent: reportContent
                                            }
                                            : msg
                                    ))
                                }
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
    }, [messages])

    return (
        <div className="flex h-full flex-col relative overflow-hidden">
            {/* Animated gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-muted/20 pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),transparent_50%)] pointer-events-none" />

            {/* Header with glass effect */}
            <motion.div
                ref={headerRef}
                className="relative z-10 flex h-16 items-center justify-between px-6 border-b border-border/30 bg-background/30 backdrop-blur-2xl"
            >
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="font-bold text-lg font-mono bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                            Research Assistant
                        </h1>
                        <p className="text-xs text-muted-foreground font-mono">AI-Powered Company Research</p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleNewResearch}
                    className="h-9 w-9 hover:bg-muted/50"
                    disabled={isLoading}
                >
                    <RefreshCw className={cn("h-4 w-4 transition-transform", isLoading && "animate-spin")} />
                </Button>
            </motion.div>

            <ScrollArea ref={scrollAreaRef} className="flex-1 relative z-10">
                <div className="space-y-6 pb-6 pt-4 px-6 max-w-4xl mx-auto">

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

                            <div className={cn("flex flex-col gap-2 max-w-[80%]", msg.role === "user" && "items-end")}>
                                {msg.role === "user" && (
                                    <div className="bg-primary text-primary-foreground rounded-2xl px-4 py-2.5 text-sm shadow-sm">
                                        {msg.content}
                                    </div>
                                )}

                                {msg.role === "assistant" && (
                                    <div className="space-y-2">
                                        {/* Show citations if they exist on the message */}
                                        {msg.citations && msg.citations.length > 0 && (
                                            <RotatingLinks links={msg.citations} />
                                        )}
                                        {/* Also support legacy separate citation messages if any */}
                                        {msg.type === "citations" && Array.isArray(msg.content) && (
                                            <RotatingLinks links={msg.content} />
                                        )}

                                        {msg.type === "conflict" && msg.content && typeof msg.content === "object" && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className={cn(
                                                    "rounded-xl border p-5 text-sm shadow-lg",
                                                    msg.content.status === "CONFLICT"
                                                        ? "bg-red-950/30 border-red-900/50"
                                                        : "bg-green-950/30 border-green-900/50"
                                                )}
                                            >
                                                <div className="flex items-center gap-2 font-semibold mb-3">
                                                    <span className={cn(
                                                        "text-base",
                                                        msg.content.status === "CONFLICT" ? "text-red-400" : "text-green-400"
                                                    )}>
                                                        {msg.content.status === "CONFLICT" ? "⚠️ Conflict Detected" : "✓ Data Verification Passed"}
                                                    </span>
                                                </div>
                                                {msg.content.reason && (
                                                    <p className="text-muted-foreground text-sm mb-4 leading-relaxed">{msg.content.reason}</p>
                                                )}
                                                {msg.content.status === "CONFLICT" && (
                                                    <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-border/30">
                                                        <Button
                                                            size="default"
                                                            variant="destructive"
                                                            onClick={(e) => {
                                                                e.preventDefault()
                                                                handleSubmit(undefined, "Yes, resolve the conflict.")
                                                            }}
                                                            disabled={isLoading}
                                                            className="flex-1 min-w-[140px] h-10 font-semibold shadow-md hover:shadow-lg transition-all"
                                                        >
                                                            Resolve Conflict
                                                        </Button>
                                                        <Button
                                                            size="default"
                                                            variant="outline"
                                                            onClick={(e) => {
                                                                e.preventDefault()
                                                                handleSubmit(undefined, "Ignore conflict and proceed.")
                                                            }}
                                                            disabled={isLoading}
                                                            className="flex-1 min-w-[140px] h-10 font-semibold border-2 hover:bg-muted/50 transition-all"
                                                        >
                                                            Ignore
                                                        </Button>
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}

                                        {(msg.type === "report" || msg.type === "text") && (
                                            <>
                                                <div className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 p-5 shadow-sm">
                                                    <TypingText
                                                        content={typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}
                                                        isStreaming={isStreamingReport && idx === messages.length - 1}
                                                    />
                                                </div>
                                                {!isStreamingReport && (
                                                    <FollowUpQuestions
                                                        content={typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}
                                                        onQuestionClick={(question) => handleSubmit(undefined, question)}
                                                    />
                                                )}
                                            </>
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

            {/* Input area with glass effect */}
            <div className="relative z-10 p-6 border-t border-border/30 bg-background/30 backdrop-blur-2xl">
                <form onSubmit={(e) => handleSubmit(e)} className="max-w-4xl mx-auto">
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
    )
}
