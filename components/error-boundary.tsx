"use client"

import React, { Component, ErrorInfo, ReactNode } from "react"
import { AlertTriangle, RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  }

  public static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false })
  }

  public render() {
    if (this.state.hasError) {
      if (this.fallback) return this.fallback

      return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-destructive/30 bg-destructive/5 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">Component failed to load</h3>
          <p className="text-xs text-muted-foreground mb-4">
            There was an error displaying this section.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={this.handleReset}
            className="gap-2 h-8 px-4 text-[10px] font-bold uppercase tracking-wider border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
          >
            <RefreshCcw className="h-3 w-3" />
            Retry
          </Button>
        </div>
      )
    }

    return this.props.children
  }

  private get fallback() {
    return this.props.fallback
  }
}
