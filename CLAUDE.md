# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a BaseX XML database viewer application for Russian construction estimation standards (ГЭСН - Государственные Элементные Сметные Нормы). The repository contains large XML databases with construction work standards, equipment pricing, and materials catalogs.

## XML Database Files

The repository contains 7 XML database files (total ~160MB):

- **ГЭСН.xml** (80MB) - Main construction standards database for building work (ГЭСН-2022)
- **ГЭСНм.xml** (47MB) - Equipment installation standards (монтаж оборудования)
- **ГЭСНмр.xml** (898KB) - Equipment installation and disassembly standards
- **ГЭСНп.xml** (2.8MB) - Industrial construction standards
- **ГЭСНр.xml** (7.3MB) - Repair and reconstruction standards
- **ФСБЦ_Мат&Оборуд.xml** (19MB) - Materials and equipment price catalog (Federal Price Catalog)
- **ФСБЦ_Маш.xml** (1MB) - Machinery price catalog

All XML files are UTF-8 encoded with BOM (Byte Order Mark).

## XML Schema Structure

### ГЭСН Standards Files (ГЭСН.xml, ГЭСНм.xml, etc.)

Root element: `<base>` with attributes:
- `PriceLevel` - Price level date (e.g., "01.01.2022")
- `BaseType` - Type of standards (e.g., "ГЭСН", "ГЭСНм")
- `BaseName` - Full database name with timestamp

Structure hierarchy:
```
base/
  Decrees/          # Decree information
  ResourcesDirectory/
    ResourceCategory/  # Top-level category (Type, CodePrefix)
      Section/         # Nested sections with hierarchy:
                       # - Type: "Сборник" (Collection), "Раздел" (Section),
                       #         "Подраздел" (Subsection), "Таблица" (Table)
                       # - Code: hierarchical code (e.g., "01", "1", "1.1")
        NameGroup/     # Work item grouping
          Work/        # Individual work standard with:
                       # - Code: unique identifier (e.g., "01-01-001-01")
                       # - EndName: descriptive name
                       # - MeasureUnit: unit of measurement
            Content/   # Description items
            Resources/ # Required resources with codes and quantities
            NrSp/      # Normative references
```

### ФСБЦ Price Catalog Files

Root element: `<ResourceCatalog>`

Structure hierarchy:
```
ResourceCatalog/
  Decrees/              # Approval information
  ResourcesDirectory/
    ResourceCategory/    # Type: "Материал" (Material)
      Section/           # Nested hierarchy:
                         # - Type: "Книга" (Book), "Часть" (Part),
                         #         "Раздел" (Section), "Группа" (Group)
                         # - Code: hierarchical code
        Resource/        # Individual resource with:
                         # - Code: unique identifier
                         # - Name: resource name
                         # - MeasureUnit: unit of measurement
          Prices/        # Price information
            Price/       # Cost and OptCost attributes
```

## BaseX Integration

This application is designed to work with BaseX XML database system for:
- Efficient querying of large XML files
- XQuery support for complex searches
- Fast navigation through hierarchical data
- Full-text search capabilities

### BaseX Installation

BaseX is not currently installed. To install:

```bash
# Download BaseX (requires Java)
wget https://files.basex.org/releases/latest/BaseX.zip
unzip BaseX.zip
cd basex
# Run BaseX server
./bin/basexserver
# Or run BaseX GUI
./bin/basexgui
```

### Typical BaseX Commands

```bash
# Start BaseX client
basex

# Create database from XML
CREATE DB gesn ГЭСН.xml

# Query database
XQUERY //Work[@Code="01-01-001-01"]

# Full-text search
XQUERY //Work[text() contains text "экскаватор"]

# Drop database
DROP DB gesn
```

## Key Characteristics

1. **Large Files**: Main ГЭSН.xml is 80MB - requires efficient XML processing
2. **Cyrillic Text**: All content is in Russian with Cyrillic characters
3. **Hierarchical Structure**: Deep nesting (5-6 levels) with Section elements
4. **Unique Codes**: Each work item and resource has a unique hierarchical code
5. **Cross-References**: Resource codes in Work elements reference price catalogs

## Development Considerations

- Handle UTF-8 with BOM correctly when parsing XML
- Implement pagination for large result sets
- Use BaseX indexing for performance with 80MB+ files
- Preserve hierarchical code structure when displaying results
- Support searching by code, name, or resource type
- Consider memory constraints when loading large XML into DOM

## Claude Permissions

**Command Execution**: Claude is authorized to execute all bash, npm, git, and system commands within this project **except**:
- Destructive operations (removing/deleting important files, database drops, force pushes)
- Security-critical operations (password changes, credential modifications)
- Commands that could harm the system or project

**Implications**: Claude will execute commands without requesting permission for normal development tasks (running servers, installing dependencies, testing, building, file operations, etc.).

## Task Management

**IMPORTANT**: This project uses a task-based development approach with detailed task tracking.

### Available Task Plans

There are TWO task plans:

1. **TASKS_MVP.md** - Minimum Viable Product (5 tasks, 2-4 hours)
   - Start with this for quick prototype
   - Basic display, hierarchy, and search only
   - Single database (ГЭСНмр.xml)
   - All code in 2 files (index.html + app.js)

2. **TASKS.md** - Full Application (21 tasks, 1-5 days)
   - Complete production-ready application
   - All 7 databases with cross-references
   - Modular architecture
   - Advanced features (export, favorites, etc.)

**Default**: Start with TASKS_MVP.md, then migrate to TASKS.md for improvements.

### Task Tracking Requirements

When working on this project, you MUST:

1. **Check the appropriate task file first** (TASKS_MVP.md or TASKS.md)
2. **Mark tasks as completed** immediately after finishing each task by changing `☐` to `☑`
3. **Update task status in real-time** - do not batch multiple task completions
4. **Follow the task order** - tasks are numbered t1, t2, t3... and should generally be completed sequentially
5. **Add comments** to completed tasks if there were deviations from the plan

### Task Completion Process

When you complete a task:

1. Edit TASKS.md
2. Find the task by its number (e.g., `### ☐ t5. Создание модуля конфигурации`)
3. Change `☐` to `☑` in the task header
4. Add a completion note if needed (optional):
   ```markdown
   ### ☑ t5. Создание модуля конфигурации
   **Completed**: 2026-01-15 - Added extra validation
   ```

### Example

Before:
```markdown
### ☐ t5. Создание модуля конфигурации
```

After:
```markdown
### ☑ t5. Создание модуля конфигурации
```

This ensures that progress is always visible and tracked throughout development.
