# Systems are logic only

A Game System holds only game state and rules over plain data. It never draws, plays sound, or reads input. The site does all rendering and input for Demos. This keeps Systems testable without a browser, portable to any engine, and makes the language behind them swappable later (see ADR 0003).
