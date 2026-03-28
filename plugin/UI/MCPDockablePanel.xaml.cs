using System;
using System.Collections.ObjectModel;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;

namespace revit_mcp_plugin.UI
{
    public partial class MCPDockablePanel : Page
    {
        private static MCPDockablePanel _instance;
        private readonly ObservableCollection<ChatMessage> _messages = new ObservableCollection<ChatMessage>();
        private readonly DispatcherTimer _statusTimer;
        private readonly ClaudeRevitClient _client;
        private bool _isProcessing;

        public static MCPDockablePanel Instance => _instance;

        public MCPDockablePanel()
        {
            InitializeComponent();
            _instance = this;
            ChatMessages.ItemsSource = _messages;
            _client = new ClaudeRevitClient();

            _statusTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(2) };
            _statusTimer.Tick += (s, e) => UpdateStatus();

            AddMessage("assistant", "Ciao! Sono Claude integrato in Revit con accesso diretto al modello.\n\n" +
                "Posso eseguire comandi sul progetto aperto. Prova:\n" +
                "- \"Che progetto ho aperto?\"\n" +
                "- \"Fai un audit del modello\"\n" +
                "- \"Crea un livello a 15000mm\"\n" +
                "- \"Mostra i warning\"\n" +
                "- \"Crea 4 muri a rettangolo 10x8 metri\"");
        }

        private void Page_Loaded(object sender, RoutedEventArgs e)
        {
            _statusTimer.Start();
            UpdateStatus();
            ChatInput.Focus();
        }

        private void UpdateStatus()
        {
            try
            {
                bool isRunning = Core.SocketService.Instance.IsRunning;
                StatusIndicator.Fill = new SolidColorBrush(isRunning
                    ? Color.FromRgb(68, 204, 136)
                    : Color.FromRgb(255, 68, 68));
                StatusText.Text = isRunning ? "MCP On" : "MCP Off";
                StatusText.Foreground = StatusIndicator.Fill;
            }
            catch { }
        }

        private void ChatInput_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Enter && !_isProcessing)
            {
                Send_Click(sender, e);
                e.Handled = true;
            }
        }

        private async void Send_Click(object sender, RoutedEventArgs e)
        {
            string input = ChatInput.Text?.Trim();
            if (string.IsNullOrEmpty(input) || _isProcessing) return;

            ChatInput.Text = "";
            AddMessage("user", input);

            _isProcessing = true;
            SendButton.IsEnabled = false;
            TypingIndicator.Visibility = Visibility.Visible;
            TypingText.Text = "Claude sta pensando...";

            try
            {
                if (!Core.SocketService.Instance.IsRunning)
                {
                    AddMessage("assistant", "Server MCP non attivo. Clicca 'Revit MCP Switch' nel ribbon per avviarlo.");
                    return;
                }

                string response = await _client.SendMessage(input);
                AddMessage("assistant", response);
            }
            catch (Exception ex)
            {
                AddMessage("assistant", $"Errore: {ex.Message}");
            }
            finally
            {
                _isProcessing = false;
                SendButton.IsEnabled = true;
                TypingIndicator.Visibility = Visibility.Collapsed;
            }
        }

        private void AddMessage(string role, string text)
        {
            Dispatcher.BeginInvoke(new Action(() =>
            {
                _messages.Add(new ChatMessage(role, text));
                ChatScrollViewer.ScrollToEnd();
            }));
        }

        public void OnToolExecuting(string toolName)
        {
            Dispatcher.BeginInvoke(new Action(() =>
            {
                TypingText.Text = $"Eseguo: {toolName}...";
                _messages.Add(new ChatMessage("tool", $"[{toolName}]"));
                ChatScrollViewer.ScrollToEnd();
            }));
        }

        public void LogCommand(string commandName, bool success, string message, double durationMs) { }

        private void ClearChat_Click(object sender, MouseButtonEventArgs e)
        {
            _messages.Clear();
            _client.ClearHistory();
        }
    }

    public class ChatMessage
    {
        public string Role { get; }
        public string Text { get; }
        public string RoleLabel { get; }
        public Thickness LabelMargin { get; }
        public Thickness BubbleMargin { get; }
        public string BubbleAlignment { get; }
        public SolidColorBrush TextColor { get; }
        public SolidColorBrush BubbleBackground { get; }
        public FontFamily FontFamily { get; }

        public ChatMessage(string role, string text)
        {
            Role = role;
            Text = text;

            switch (role)
            {
                case "user":
                    RoleLabel = "Tu";
                    LabelMargin = new Thickness(0, 2, 12, 0);
                    BubbleMargin = new Thickness(50, 0, 8, 0);
                    BubbleAlignment = "Right";
                    TextColor = new SolidColorBrush(Color.FromRgb(224, 224, 240));
                    BubbleBackground = new SolidColorBrush(Color.FromRgb(59, 59, 92));
                    FontFamily = new FontFamily("Segoe UI");
                    break;
                case "tool":
                    RoleLabel = "";
                    LabelMargin = new Thickness(12, 2, 0, 0);
                    BubbleMargin = new Thickness(8, 0, 50, 0);
                    BubbleAlignment = "Left";
                    TextColor = new SolidColorBrush(Color.FromRgb(100, 200, 120));
                    BubbleBackground = new SolidColorBrush(Color.FromRgb(30, 42, 30));
                    FontFamily = new FontFamily("Consolas");
                    break;
                default:
                    RoleLabel = "Claude";
                    LabelMargin = new Thickness(12, 2, 0, 0);
                    BubbleMargin = new Thickness(8, 0, 50, 0);
                    BubbleAlignment = "Left";
                    TextColor = new SolidColorBrush(Color.FromRgb(200, 200, 220));
                    BubbleBackground = new SolidColorBrush(Color.FromRgb(42, 42, 60));
                    FontFamily = new FontFamily("Segoe UI");
                    break;
            }
        }
    }
}
