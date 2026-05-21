#if REVIT2025_OR_GREATER
using Nice3point.TUnit.Revit.Executors;
using TUnit.Core.Executors;

[assembly: TestExecutor<RevitThreadExecutor>]
#endif
