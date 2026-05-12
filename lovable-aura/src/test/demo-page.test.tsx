import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "@/App";

describe("demo architecture page", () => {
  it("renders the public architecture walkthrough route", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        text: async () => "offline in route smoke test",
        json: async () => ({}),
      })),
    );
    window.history.pushState({}, "", "/demo");

    render(<App />);

    expect(await screen.findByText("Architecture Walkthrough")).toBeTruthy();
    expect(screen.getByText("Model and Stack Choices")).toBeTruthy();
  });
});
