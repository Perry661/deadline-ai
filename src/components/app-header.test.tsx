import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { AppHeader } from "./app-header";

it("shows the product identity and new-task action", () => {
  render(<AppHeader />);
  expect(screen.getByText("Deadline AI")).toBeVisible();
  expect(screen.getByRole("link", { name: /new task/i })).toHaveAttribute(
    "href",
    "/tasks/new",
  );
});
