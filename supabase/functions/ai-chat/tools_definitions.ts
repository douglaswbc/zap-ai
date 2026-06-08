export const tools = [
    {
        type: "function",
        function: {
            name: "list_services",
            description: "Lista os serviços disponíveis na clínica.",
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "list_professionals",
            description: "Lista os profissionais (massoterapeutas) disponíveis e suas especialidades.",
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "list_professional_hours",
            description: "Consulta a jornada de trabalho semanal de todos os profissionais (horários de entrada e saída por dia). Use isso para entender os turnos teóricos antes de oferecer horários.",
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "get_available_slots",
            description: "Busca horários disponíveis para agendamento. Se professional_id não for informado, busca horários onde qualquer profissional e sala estejam livres, respeitando o limite de 4 atendimentos simultâneos.",
            parameters: {
                type: "object",
                properties: {
                    professional_id: { type: "string", description: "Opcional: ID do profissional. Se omitido, busca disponibilidade geral." },
                    date: { type: "string", description: "Formato YYYY-MM-DD" }
                },
                required: ["date"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "create_appointment",
            description: "Realiza o agendamento de um serviço. Aloca dinamicamente profissional e sala se não especificados.",
            parameters: {
                type: "object",
                properties: {
                    professional_id: { type: "string", description: "Opcional: ID do profissional." },
                    date: { type: "string" },
                    time: { type: "string", description: "Formato HH:mm" }
                },
                required: ["date", "time"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "list_my_appointments",
            description: "Consulta os agendamentos realizados pelo usuário atual pelo número de telefone.",
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "cancel_appointment",
            description: "Cancela um agendamento existente.",
            parameters: {
                type: "object",
                properties: {
                    appointment_id: { type: "string", description: "ID (UUID) do agendamento a ser cancelado" }
                },
                required: ["appointment_id"]
            }
        }
    }
];